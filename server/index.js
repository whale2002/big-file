const express = require("express");
const logger = require("morgan");
const cors = require("cors");
const fs = require("fs-extra");
const path = require("path");

const CHUNK_SIZE = 1024 * 1024 * 100; // 100MB

const PUBLIC_DIR = path.resolve(__dirname, "public");
const TEMP_DIR = path.resolve(__dirname, "temp");

fs.ensureDirSync(PUBLIC_DIR); // 保证文件夹一定存在
fs.ensureDirSync(TEMP_DIR); // 保证文件夹一定存在

const app = express();
app.use(cors());
app.use(logger("dev"));
app.use(express.json()); // json
app.use(express.urlencoded({ extended: false })); // 表单
app.use(express.static(PUBLIC_DIR));

app.post("/upload/:filename", async (req, res, next) => {
  // 通过路径参数获取文件名
  const { filename } = req.params;
  // 通过查询参数获取分片名
  const { chunkName } = req.query;

  const start = req.query.start ? parseInt(req.query.start) : 0;

  const tempFileDir = path.resolve(TEMP_DIR, filename); // 临时目录
  const chunkFilePath = path.resolve(tempFileDir, chunkName); // 临时文件路径地址
  await fs.ensureDir(tempFileDir); // 确保存在
  const ws = fs.createWriteStream(chunkFilePath, {
    start,
    flags: "a",
  });

  try {
    await pipeStream(req, ws);
    res.json({
      success: true,
    });
  } catch (e) {
    next(e);
  }
});

app.get("/merge/:filename", async (req, res, next) => {
  const { filename } = req.params;

  try {
    await mergeChunks(filename);
    res.json({
      success: true,
    });
  } catch (e) {
    next(e);
  }
});

app.get("/verify/:filename", async (req, res) => {
  const { filename } = req.params;
  const filePath = path.resolve(PUBLIC_DIR, filename);
  const isExist = await fs.pathExists(filePath);
  if (isExist) {
    return res.json({
      success: true,
      needUpload: false,
    });
  }

  const tempDir = path.resolve(TEMP_DIR, filename);
  const isDirexist = await fs.pathExists(tempDir);
  console.log(tempDir, isDirexist);

  if (isDirexist) {
    const chunkFiles = fs.readdirSync(tempDir);
    const uploadedChunkList = await Promise.all(
      chunkFiles.map(async (chunkFileName) => {
        const { size } = await fs.stat(path.resolve(tempDir, chunkFileName));
        return {
          chunkFileName,
          size,
        };
      })
    );
    return res.json({
      success: true,
      needUpload: true,
      uploadedChunkList,
    });
  }
  return res.json({
    success: true,
    needUpload: true,
  });
});

app.listen(8000, () => {
  console.log("Server is running on port 8000");
});

/**
 * 将可读流中的数据写入可写流中
 * @param {request} rs 可读流
 * @param {stream} ws 可写流
 * @returns
 */
function pipeStream(rs, ws) {
  return new Promise((resolve, reject) => {
    // 将可读流中的数据写入可写流中
    rs.pipe(ws).on("finish", resolve).on("error", reject);
  });
}

async function mergeChunks(fileName) {
  const mergedFilePath = path.resolve(PUBLIC_DIR, fileName);
  const chunkDir = path.resolve(TEMP_DIR, fileName);
  const chunkFiles = fs.readdirSync(chunkDir);
  chunkFiles.sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));

  try {
    // 并发读写
    const pipes = chunkFiles.map((chunkFile, index) => {
      const rs = fs.createReadStream(path.resolve(chunkDir, chunkFile), {
        autoClose: true,
      });
      const ws = fs.createWriteStream(mergedFilePath, {
        start: index * CHUNK_SIZE,
      });
      return pipeStream(rs, ws);
    });
    await Promise.all(pipes);
    await fs.rmdir(chunkDir, { recursive: true });
  } catch (error) {
    throw error;
  }
}
