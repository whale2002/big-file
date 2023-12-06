const express = require("express");
const logger = require("morgan");
const cors = require("cors");
const fs = require("fs-extra");
const path = require("path");
const { StatusCodes } = require("http-status-codes");

fs.ensureDirSync(path.resolve(__dirname, "public")); // 保证文件夹一定存在
fs.ensureDirSync(path.resolve(__dirname, "temp")); // 保证文件夹一定存在

const app = express();
app.use(cors());
app.use(logger("dev"));
app.use(express.json()); // json
app.use(express.urlencoded({ extended: false })); // 表单

app.post("/upload/:filename", async (req, res, next) => {
  // 通过路径参数获取文件名
  const { filename } = req.params;
  // 通过查询参数获取分片名
  const { chunkName } = req.query;
  console.log(filename, chunkName);
  res.json({
    success: true,
  });
});

app.get("/merge/:filename", async (req, res, next) => {
  const { filename } = req.params;
  console.log(filename);
  res.json({
    success: true,
  });
});

app.listen(8000, () => {
  console.log("Server is running on port 8000");
});
