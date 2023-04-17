import React from 'react';
import { Link } from 'react-router-dom';
import CreatePromptForm from '../../components/create-prompt-form';
import PromptList from '../../components/questions-list';

const Admin = () =>{  return (
    <div>
      <h1  className="text-3xl font-bold underline">Admin Panel Prompt Creator</h1>
      <CreatePromptForm />
      {/* <nav>
        <ul>
          <li>
            <Link to="/sobre">Sobre</Link>
          </li>
          <li>
            <Link to="/usuario">Usuario</Link>
          </li>
        </ul>
      </nav> */}
    </div>
  );
}

export default Admin;