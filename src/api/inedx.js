import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost/takehome-challenge/controller/QuestionController.php",
});

export default api;