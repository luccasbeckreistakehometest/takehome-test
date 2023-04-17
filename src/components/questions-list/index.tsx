import { useEffect } from "react";
import { useUser } from "../../hooks/useUser";

const PromptList = () =>  {
  const {questionList} = useUser()

  
  return (
    <div>
        <ul>
            {questionList()}
        </ul>
    </div>

  );
}

export default PromptList