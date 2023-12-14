import { useState, useEffect, useRef } from 'react'
import { InboxOutlined } from '@ant-design/icons'
import { Button, message, Progress } from 'antd'
import useDrag from './hooks/useDrag'
import type { PreviewInfo } from './hooks/useDrag'
import { getFileName } from './utils'
import { request } from './request'
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
    const fileName = await getFileName(selectedFile)
    console.log(fileName);
    const res = await uploadFile(selectedFile, fileName, setUploadProgress)
    if(res?.success) {
      message.success(res.message)
      if(res.needUpload !== undefined) {
        reset()
      } else {
        setUploadStatue(UPLOAD_STATUS.SUCCESS)
      }
    } else {
      message.error(res?.message)
      setUploadStatue(UPLOAD_STATUS.FAILED)
    }
  }
  const pauseUpload = () => {
    
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
          {chunkProgress}
          {totalProgress}
        </div>
      )
    }
  }

  useEffect(() => {
    if(!selectedFile) return
  }, [selectedFile])

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
export async function uploadFile(file: File, fileName: string, setUploadProgress: React.Dispatch<React.SetStateAction<{}>>) {
  const isExistRes = await request.get<{ needUpload: boolean, success: boolean }>(`/verify/${fileName}`)
  if(!isExistRes.data.needUpload) {
    return {
      success: isExistRes.data.success,
      needUpload: isExistRes.data.needUpload,
      message: '文件已存在, 秒传成功'
    }
  }
  const chunks = createFileChunk(file, fileName);
  const uploadPromises = chunks.map(({ chunk, chunkName }) => {
    return uploadChunk(fileName, chunkName, chunk, setUploadProgress);
  });

  try {
    await Promise.all(uploadPromises);
    await request.get(`/merge/${fileName}`);
    return {
      success: true,
      message: '上传成功'
    };
  } catch (e) {
    console.log("上传错误", e);
    return {
      success: false,
      message: '上传失败'
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

function uploadChunk(fileName: string, chunkName: string, chunk: Blob, setUploadProgress: React.Dispatch<React.SetStateAction<{}>>) {
  return request.post(`/upload/${fileName}`, chunk, {
    headers: {
      "Content-Type": "application/octet-stream",
    },
    params: {
      chunkName,
    },
    onUploadProgress: (e: ProgressEvent) => {
      const percent = Math.round((e.loaded / e.total) * 100);
      setUploadProgress((preProcess) => ({
        ...preProcess,
        [chunkName]: percent,
      }))
    }
  });
}