import fs from 'node:fs';
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist',{recursive:true});fs.cpSync('public','dist',{recursive:true});fs.cpSync('src','dist/src',{recursive:true});fs.copyFileSync('index.html','dist/index.html');console.log('dist/ created');
