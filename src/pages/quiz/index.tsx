import { useEffect, useState } from 'react';
import api from '../../api/inedx';
import { useUser } from '../../hooks/useUser';

const Quiz = () =>{ 

    const {questions, userHash} = useUser()
    
    const [counter, setCounter] = useState(180);
    const [percentageLeft, setPercentageLeft] = useState(100);

    const [questionIndex, setQuestionIndex] = useState(0)
    const [answer, setAnswer] = useState<string>('')
    const questionsNumber = questions.length

    function handleChange(event: any) {
        setAnswer(event.target.value);
      }

      const handleNext = () => {
        saveAnswer()
        setAnswer('')
        setQuestionIndex(questionIndex + 1)
        setCounter(180)
      }

      const updateBar = () =>  
        setPercentageLeft(counter / 1.8)
    

      const ProgressBar = () => {
        return (
            <div className='h-1 w-full bg-gray-300'>
                <div
                    style={{ width: `${percentageLeft}%`}}
                    className={`h-full ${
                        percentageLeft < 30 ? 'bg-red-600' : 'bg-green-600'}`}>
                </div>
            </div>
        );
        };
      
      useEffect(() => {
        counter > 0 && setTimeout(() => setCounter(counter - 1), 1000)
        updateBar()
      }, [counter]);

      const saveAnswer = async () => {
        try {
            const anwerAPI = await api
            .post("Quiz",{
               user: userHash,
               questionIndex: questionIndex,
               answer: answer
            })
        } catch {
            console.log('error found')
        }
        
      }
      

    return (
        
        <div>
            {(questionIndex < questionsNumber) ?(
        <div className="h-screen w-full flex items-center bg-[rgba(0,0,0,.5)]">
            <div className=" text-center bg-white p-8 mx-auto rounded-lg max-w-[600px] w-11/12">
                <h4 className="text-3xl pb-3 text-center font-bold">
                {(questionIndex+1) + ' - ' + questions[questionIndex].question}
                </h4>
                <div className="py-2">
                <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" type="text" placeholder="Type your anser here" onChange={handleChange} value={answer ?? ''}/>
                </div>
                <ProgressBar />
                <button
                disabled={answer === '' || answer === undefined ? true : false}
                className={answer === '' || answer === undefined ? "bg-gray-600 py-2 px-7 rounded-xl text-white mt-2 hover:bg-yellow-500" : "bg-yellow-600 py-2 px-7 rounded-xl text-white mt-2 hover:bg-yellow-500" }
                onClick={handleNext}
                >
                Next
                </button>
            </div>
            </div>
            ) : (
                <div className="h-screen w-full flex items-center bg-[rgba(0,0,0,.5)]">
                    <div className=" text-center bg-white p-8 mx-auto rounded-lg max-w-[600px] w-11/12">
                        <h4 className="text-3xl pb-3 text-center font-bold">
                            THANKS FOR SUBMITTING THE TEST!
                        </h4>
                       
                    </div>
                    </div>
            )}
    </div>
        
    
  );
}

export default Quiz;