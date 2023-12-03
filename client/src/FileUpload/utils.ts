export async function getFileName(file: File) {
  const fileName = await calculateFileHash(file);
  return `${fileName}.${file.name.split(".").pop()}`;
}

/**
 * 异步函数，用于计算文件的哈希值
 * @param file 文件对象
 * @returns 哈希值的十六进制表示
 */
async function calculateFileHash(file: File) {
  const arrayBuffer = await file.arrayBuffer(); // 获取文件的二进制内容
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return bufferToHex(hashBuffer);
}

/**
 * 将ArrayBuffer转换为十六进制字符串
 * @param buffer - 要转换的ArrayBuffer对象
 * @returns 十六进制字符串
 */
function bufferToHex(buffer: ArrayBuffer) {
  return Array.prototype.map
    .call(new Uint8Array(buffer), (x) => ("00" + x.toString(16)).slice(-2))
    .join("");
}
