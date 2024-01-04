import { useState, useEffect, useRef } from 'react'
import { InboxOutlined } from '@ant-design/icons'
import axios from '@whale2002/ts-axios'
import { Button, message, Progress, Spin } from 'antd'
import useDrag from './hooks/useFile'
// import { getFileName } from './utils'
import { request } from './request'
import type { CancelTokenSource } from '@whale2002/ts-axios'
import type { PreviewInfo } from './hooks/useFile'
import styles from './index.module.less'

// 每个切片的大小 100MB
const CHUNK_SIZE = 100 * 1024 * 1024;
enum UPLOAD_STATUS {
  NOT_STARTED = 'NOT_STARTED', // 初始状态，尚未开始上传
  UPLOADING = 'UPLOADING',     // 上传中
  PAUSED = 'PAUSED',            // 已暂停上传
  SUCCESS = 'SUCCESS',          // 上传成功
  FAILED = 'FAILED',            // 上传失败
}

export default function FileUpload() {
  const uploadContainerRef = useRef<HTMLDivElement>(null)
  const {selectedFile, previewInfo, resetFileStatus} = useDrag(uploadContainerRef)
  const [uploadStatue, setUploadStatue] = useState<UPLOAD_STATUS>(UPLOAD_STATUS.NOT_STARTED)
  const [uploadProgress, setUploadProgress] = useState<Record<string, any>>({})
  const [cancelTokens, setCancelTokens] = useState<CancelTokenSource[]>([]) // 所有上传请求的取消 token
  const [fileNameWorker, setFileNameWorker] = useState<Worker>()
  const [isCalculatingFileName, setIsCalculatingFileName] = useState(false)

  const reset = () => {
    setUploadStatue(UPLOAD_STATUS.NOT_STARTED)
    resetFileStatus()
    setUploadProgress({})
  }
  const handleUpload = async () => {
    if(!selectedFile) {
      message.error('请选择文件')
      return
    }

    setUploadStatue(UPLOAD_STATUS.UPLOADING)

    if(!fileNameWorker) return

    // 向 worker 发送文件，让它计算文件名
    fileNameWorker.postMessage(selectedFile)
    setIsCalculatingFileName(true)

    // 监听，接收计算好的文件名
    fileNameWorker.onmessage = async (event) => {
      setIsCalculatingFileName(false)
      console.log(event.data);
      const res = await uploadFile(selectedFile, event.data, setUploadProgress, setCancelTokens)
      if(res.success) {
        message.success(res.message)
        if(typeof res.needUpload === 'boolean') {
          // 秒传，清空
          reset()
        } else {
          // 上传成功 UPLOAD_STATUS.SUCCESS
          setUploadStatue(res.status!)
        }
      } else {
        // 取消上传或者上传失败
        message.error(res?.message)
        setUploadStatue(res.status!)
      }
    }
  }
  const pauseUpload = () => {
    setUploadStatue(UPLOAD_STATUS.PAUSED)
    cancelTokens.forEach((cancelToken) => {
      cancelToken.cancel('用户主动暂停了')
    })
  }

  const renderButton = (status: UPLOAD_STATUS) => {
    switch (status) {
      case UPLOAD_STATUS.NOT_STARTED:
          return <Button onClick={handleUpload}>上传</Button>
      case UPLOAD_STATUS.UPLOADING:
          return <Button onClick={pauseUpload}>暂停</Button>
      case UPLOAD_STATUS.PAUSED:
          return <Button onClick={handleUpload}>恢复上传</Button>
      case UPLOAD_STATUS.SUCCESS:
          return <Button onClick={reset}>上传成功, 点击重置</Button>
      case UPLOAD_STATUS.FAILED:
          return <Button onClick={reset}>上传失败, 点击重置</Button>
    }
  }

  const renderPreview = (previewInfo: PreviewInfo) => {
    const { url, type } = previewInfo
    if(!url) return <InboxOutlined />
  
    if(type.startsWith('video/')) {
      return (
        <video src={url} controls />
      )
    } else if(type.startsWith('image/')) {
      return (
        <img src={url} />
      )
    } else {
      return url
    }
  }

  const renderProgress = () => {
    if(uploadStatue !== UPLOAD_STATUS.NOT_STARTED) {
      const chunkProgress = Object.keys(uploadProgress).map((chunkName, index) => {
        return (
          <div key={chunkName}>
            <span>切片{index}: </span>
            <Progress percent={uploadProgress[chunkName]} />
          </div>
        )
      })

      const percents = Object.values(uploadProgress)
      const totalPercent = Math.round(percents.reduce((acc, curr) => acc + curr, 0) / percents.length)
      const totalProgress = (
        <div>
          <span>总进度: </span>
          <Progress percent={totalPercent} />
        </div>
      )

      return (
        <div style={{ width: '50%' }}>
          <Spin spinning={isCalculatingFileName}>
            {chunkProgress}
            {totalProgress}
          </Spin>
        </div>
      )
    }
  }

  useEffect(() => {
    if(!selectedFile) return
  }, [selectedFile])

  useEffect(() => {
    const fileNameWorker = new Worker('/fileNameWorker.js')
    setFileNameWorker(fileNameWorker)
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles["upload-container"]} ref={uploadContainerRef}>
        {renderPreview(previewInfo)}
      </div>
      {renderButton(uploadStatue)}
      {renderProgress()}
    </div>
  )
}

// key: 核心代码
interface VerifyRes {
  needUpload: boolean,
  success: boolean,
  uploadedChunkList: {
    chunkFileName: string,
    size: number
  }[]
}
export async function uploadFile(file: File, fileName: string, setUploadProgress: React.Dispatch<React.SetStateAction<Record<string, any>>>, setCancelTokens: React.Dispatch<React.SetStateAction<CancelTokenSource[]>>, retryCount: number = 0) {
  const isExistRes = await request.get<VerifyRes>(`/verify/${fileName}`)
  const { needUpload, uploadedChunkList = [] } = isExistRes.data
  if(!needUpload) {
    return {
      success: isExistRes.data.success,
      needUpload: isExistRes.data.needUpload,
      message: '文件已存在, 秒传成功'
    }
  }
  const chunks = createFileChunk(file, fileName);
  const newCancelTokens: CancelTokenSource[] = []
  const uploadPromises = chunks.map(({ chunk, chunkName }) => {
    const cancelToken = axios.CancelToken.source()
    newCancelTokens.push(cancelToken)

    const existChunk = uploadedChunkList.find(uploadedChunk => uploadedChunk.chunkFileName === chunkName)
    if(existChunk) {
      const uploadedSize = existChunk.size; // 已经上传的大小
      const remainingChunk = chunk.slice(uploadedSize)
      if(remainingChunk.size === 0) {
        // 上传完了，不需要再上传
        setUploadProgress((preProgress) => ({
          ...preProgress,
          [chunkName]: 100
        }))
        return Promise.resolve()
      } 
      setUploadProgress((preProgress) => ({
        ...preProgress,
        [chunkName]: Math.round((uploadedSize / chunk.size) * 100)
      }))
      return uploadChunk(fileName, chunkName, remainingChunk, setUploadProgress, cancelToken, uploadedSize, chunk.size)
    } else {
      return uploadChunk(fileName, chunkName, chunk, setUploadProgress, cancelToken, 0, chunk.size);
    }
  });
  setCancelTokens(newCancelTokens)

  try {
    await Promise.all(uploadPromises);
    await request.get(`/merge/${fileName}`);
    return {
      success: true,
      message: '上传成功',
      status: UPLOAD_STATUS.SUCCESS
    };
  } catch (e) {
    console.log("上传错误", e);
    if(axios.isCancel(e)) {
      return {
        success: false,
        message: '取消上传',
        status: UPLOAD_STATUS.PAUSED
      }
    }
    if(retryCount < 3) {
      console.log('上传出错，重试中');
      return uploadFile(file, fileName, setUploadProgress, setCancelTokens, retryCount + 1);
    }
    return {
      success: false,
      message: '上传失败',
      status: UPLOAD_STATUS.FAILED
    };
  }
}

function createFileChunk(file: File, fileName: string) {
  const chunks: { chunk: Blob; chunkName: string }[] = [];
  const chunkCount = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < chunkCount; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    chunks.push({
      chunk,
      chunkName: `${fileName}-${i}`,
    });
  }
  return chunks;
}

function uploadChunk(
  fileName: string,
  chunkName: string,
  chunk: Blob,
  setUploadProgress: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  cancelToken: CancelTokenSource,
  start: number,
  totalSize: number
) {
  return request.post(`/upload/${fileName}`, chunk, {
    headers: {
      "Content-Type": "application/octet-stream",
    },
    params: {
      chunkName,
      start,
    },
    cancelToken: cancelToken.token,
    onUploadProgress: (e: ProgressEvent) => {
      const percent = Math.round((e.loaded + start) * 100 / totalSize);
      setUploadProgress((preProcess) => ({
        ...preProcess,
        [chunkName]: percent,
      }))
    }
  });
}