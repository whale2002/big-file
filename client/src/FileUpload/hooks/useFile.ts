import { useState, useEffect, useCallback } from "react";
import { message } from "antd";

const MAX_FILE_SIZE = 1024 * 1024 * 1024 * 2; // 2G

export type PreviewInfo = {
  url: string;
  type: string;
};

export default function useFile(
  uploadContainerRef: React.RefObject<HTMLElement>
) {
  const [selectedFile, setSelectedFile] = useState<File>();
  const [previewInfo, setPreviewInfo] = useState<PreviewInfo>({
    url: "",
    type: "",
  });

  const checkFile = (files: FileList) => {
    const file = files[0];
    if (!file) {
      message.error("请选择文件");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      message.error("文件大小超过2G");
      return;
    }
    setSelectedFile(file);
  };

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault(); // 阻止默认行为
    e.stopPropagation(); // 阻止冒泡
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    checkFile(e.dataTransfer!.files);
  }, []);

  useEffect(() => {
    const uploadContainer = uploadContainerRef.current;
    if (!uploadContainer) return;
    uploadContainer.addEventListener("dragenter", handleDrag);
    uploadContainer.addEventListener("dragover", handleDrag);
    uploadContainer.addEventListener("drop", handleDrop);
    uploadContainer.addEventListener("dragleave", handleDrag);

    return () => {
      uploadContainer.removeEventListener("dragenter", handleDrag);
      uploadContainer.removeEventListener("dragover", handleDrag);
      uploadContainer.removeEventListener("drop", handleDrop);
      uploadContainer.removeEventListener("dragleave", handleDrag);
    };
  }, []);

  useEffect(() => {
    const uploadContainer = uploadContainerRef.current;
    if (!uploadContainer) return;
    uploadContainer.addEventListener("click", () => {
      // 动态创建 input 标签
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.style.display = "none";
      fileInput.addEventListener("change", (event) => {
        const files = (event.target as HTMLInputElement)!.files;
        if (!files) return;
        checkFile(files);
      });
      document.body.appendChild(fileInput);
      fileInput.click();
    });
  }, []);

  useEffect(() => {
    if (!selectedFile) return;
    const url = URL.createObjectURL(selectedFile);
    setPreviewInfo({
      url,
      type: selectedFile.type,
    });
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  const resetFileStatus = () => {
    setSelectedFile(undefined);
    setPreviewInfo({
      url: "",
      type: "",
    });
  };

  return {
    selectedFile,
    previewInfo,
    resetFileStatus,
  };
}
