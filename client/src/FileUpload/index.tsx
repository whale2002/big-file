import { useState, useEffect, useRef } from 'react'
import { InboxOutlined } from '@ant-design/icons'
import { Button, message } from 'antd'
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
  PAUSED = 'PAUSED'            // 已暂停上传
}

export default function FileUpload() {
  const uploadContainerRef = useRef<HTMLDivElement>(null)
  const {selectedFile, previewInfo} = useDrag(uploadContainerRef)
  const [uploadStatue, setUploadStatue] = useState<UPLOAD_STATUS>(UPLOAD_STATUS.NOT_STARTED)

  const handleUpload = async () => {
    if(!selectedFile) {
      message.error('请选择文件')
      return
    }

    setUploadStatue(UPLOAD_STATUS.UPLOADING)
    const fileName = await getFileName(selectedFile)
    console.log(fileName);
    const res = await uploadFile(selectedFile, fileName)
    if(res) {
      message.success('上传成功')
    } else {
      message.error('上传失败')
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

  useEffect(() => {
    if(!selectedFile) return
  }, [selectedFile])

  return (
    <div className={styles.container}>
      <div className={styles["upload-container"]} ref={uploadContainerRef}>
        {renderPreview(previewInfo)}
      </div>
      {renderButton(uploadStatue)}
    </div>
  )
}

// key: 核心代码
export async function uploadFile(file: File, fileName: string) {
  const chunks = createFileChunk(file, fileName);
  const uploadPromises = chunks.map(({ chunk, chunkName }) => {
    return uploadChunk(fileName, chunkName, chunk);
  });

  try {
    await Promise.all(uploadPromises);
    await request.get(`/merge/${fileName}`);
    return true;
  } catch (e) {
    console.log("上传错误", e);
    return false;
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

function uploadChunk(fileName: string, chunkName: string, chunk: Blob) {
  return request.post(`/upload/${fileName}`, chunk, {
    headers: {
      "Content-Type": "application/octet-stream",
    },
    params: {
      chunkName,
    },
  });
}