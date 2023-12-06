import axios from "@whale2002/ts-axios";
import { message } from "antd";

// 每个切片的大小 100MB
const CHUNK_SIZE = 100 * 1024 * 1024;

export const request = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

request.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success) {
      return response.data;
    } else {
      throw new Error(response.data.message || "服务器端错误");
    }
  },
  (error) => {
    console.log("erroe", error);
    throw error;
  }
);

export async function uploadFile(file: File, fileName: string) {
  const chunks = createFileChunk(file, fileName);
  const uploadPromises = chunks.map(({ chunk, chunkName }) => {
    return createRequest(fileName, chunkName, chunk);
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

function createRequest(fileName: string, chunkName: string, chunk: Blob) {
  return request.post(`/upload/${fileName}`, chunk, {
    headers: {
      "Content-Type": "application/octet-stream",
    },
    params: {
      chunkName,
    },
  });
}
