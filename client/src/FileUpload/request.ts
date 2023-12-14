import axios from "@whale2002/ts-axios";

export const request = axios.create({
  baseURL: "http://127.0.0.1:8000",
});
