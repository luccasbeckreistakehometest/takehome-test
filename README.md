steps to setup:

- yarn install
- yarn start

This application has 2 ends: 

Home (''): which is the quiz, it loads the questions from the backend, if any error, it loads the default ones previously determined, on creating a new session, all of the answers are sent to backend along with userHash(session), questionID and the proper answer

Admin('/admin'): this is the admin panel, which adm can upload new questions to database
