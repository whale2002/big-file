import axios from "@whale2002/ts-axios";

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
