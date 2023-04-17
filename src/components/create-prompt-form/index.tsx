import { useForm } from "react-hook-form";
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from "yup";
import { useUser } from "../../hooks/useUser";
import api from "../../api/inedx";

const schema = yup.object({
  question: yup.string().required(),
}).required();

const CreatePromptForm = () =>  {
  const { register, handleSubmit, formState:{ errors } } = useForm({
    resolver: yupResolver(schema)
  });
  const onSubmit = (data: any) => {
    api
     .post("",data)
     .then((response) => console.log(response.data))
     .catch((err) => {
       console.error("ops! error on communicating with api" + err);
     });
  };

  return (


<form className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4" onSubmit={handleSubmit(onSubmit)}>
<div className="mb-4">
  <label className="block text-gray-700 text-sm font-bold mb-2">
    Question
  </label>
  <input {...register("question")} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="username" type="text" placeholder="Type your question here" />
  <p> {errors.question?.message?.toString()}</p>
</div>

<div className="flex items-center justify-between">
  <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" type="submit">
    Save Question
  </button>
</div>
</form>

  );
}

export default CreatePromptForm