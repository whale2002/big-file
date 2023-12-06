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
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer); // 对arrayBuffer进行哈希计算，加密
  return bufferToHex(hashBuffer); // 将hashBuffer转换为十六进制字符串

  // 或者使用FileReader，需要结合 promise 使用
  // const fileReader = new FileReader();
  // fileReader.readAsArrayBuffer(file);
  // fileReader.onload = (e) => {
  //   const arrayBuffer = e.target?.result as ArrayBuffer;
  //   const hashBuffer = crypto.subtle.digest("SHA-256", arrayBuffer);
  //   const hash = bufferToHex(hashBuffer);
  //   resolve(hash);
  // };
}

/**
 * 将ArrayBuffer转换为十六进制字符串
 * @param buffer - 要转换的ArrayBuffer对象
 * @returns 十六进制字符串
 */
function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
