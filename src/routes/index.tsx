
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { UserProvider } from '../contexts/UserContext';

import Admin from "../pages/admin";
import Quiz from "../pages/quiz";
// import Sobre from "./Sobre";
// import Usuario from "./Usuario";

const Router = () => {
   return(
    <BrowserRouter>
    <UserProvider>
       <Routes>
           <Route Component={ Quiz }  path="/"  />
           <Route Component={ Admin }  path="/admin"  />
           {/* <Route component = { Sobre }  path="/sobre" />
           <Route component = { Usuario }  path="/usuario" /> */}
       </Routes>
       </UserProvider>
       </BrowserRouter>
   )
}

export default Router;