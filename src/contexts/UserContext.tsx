import { createContext, ReactNode, useEffect, useState } from "react"
import api from "../api/inedx"
import { Prompt } from "../interfaces/Prompt"

type UserContextData = {
    userHash: string
    addPrompt: (prompt: Prompt) => void
    questionList: () => string[]
    questions: Prompt[]
}

type UserProviderProps = {
    children: ReactNode
}

export const UserContext = createContext({} as UserContextData)

export function  UserProvider ({children}: UserProviderProps) {
    const [userHash, setUserHash] = useState('')
    const [questions, setQuestions] = useState<Prompt[]>([
        { question: 'what is your name?'},
        { question: 'what is your age?'},

    ])

    const getQuestions = async () => {
        try {
            const questionsAPI = await api
            .get("")
            if(questionsAPI.data) {
                let questionsList: Prompt[] = []
                questionsAPI.data.map((q: { id: number, question: string }) => questions.push({question: q.question}))
                setQuestions(questionsList)
            }
        }
        catch (err) {
            console.log('error loading database questions, using static ones')
        }
        
    }

    const createHash = () => {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789*!';
        const charactersLength = characters.length;
        let counter = 0;
        while (counter < 100) {
          result += characters.charAt(Math.floor(Math.random() * charactersLength));
          counter += 1;
        }
        return result;
    }

    const questionList = () => {
        let questionList: string[] = []
        questions?.map(q => questionList.push(q.question))
        return questionList
    }

    function addPrompt(prompt: Prompt) {
        let questionArray = questions ?? []
        console.log(questionArray)
        questionArray.push(prompt)
        setQuestions(questionArray)
    }
    
    useEffect(() => {
        setUserHash(createHash)
        getQuestions()
    }, [])
    

    return (<UserContext.Provider 
        value={{
            userHash,
            addPrompt,
            questionList,
            questions
        }}>
            {children}
        </UserContext.Provider>
    )
}