import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import {BufferReader, Lexer, Parser} from "@/scenario/parser.ts";

fetch("/data/test.scn")
    .then(response => {
        if (response.body !== null) {
            return response.body;
        }
        throw new Error("Unable to fetch data.");
    })
    .then(body => body.getReader())
    .then(reader => reader.read())
    .then(chunk => {
        if (chunk.value) {
            return chunk.value;
        }
        throw new Error("Unable to read data.");
    })
    .then(bytes => new TextDecoder().decode(bytes))
    .then(source => new BufferReader(source))
    .then(reader => new Lexer(reader))
    .then(lexer => new Parser(lexer))
    .then(parser => parser.parse())
    .then(scenes => console.log(scenes))
    .catch(e => console.error(e));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
