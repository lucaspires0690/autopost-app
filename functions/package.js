(
echo {
echo   "name": "youtube-autopost-functions",
echo   "version": "1.0.0",
echo   "description": "Cloud Functions para agendamento automático de vídeos no YouTube",
echo   "scripts": {
echo     "serve": "firebase emulators:start --only functions",
echo     "shell": "firebase functions:shell",
echo     "start": "npm run shell",
echo     "deploy": "firebase deploy --only functions",
echo     "deploy:check": "firebase deploy --only functions:checkScheduledPosts",
echo     "logs": "firebase functions:log",
echo     "logs:check": "firebase functions:log --only checkScheduledPosts",
echo     "logs:tail": "firebase functions:log --only checkScheduledPosts --since 1h",
echo     "auth": "node autoAuth.js",
echo     "check-tokens": "node checkTokens.js",
echo     "test": "echo \"Error: no test specified\" && exit 1"
echo   },
echo   "engines": {
echo     "node": "18"
echo   },
echo   "main": "index.js",
echo   "dependencies": {
echo     "firebase-admin": "^12.0.0",
echo     "firebase-functions": "^5.0.0",
echo     "googleapis": "^144.0.0"
echo   },
echo   "devDependencies": {
echo     "firebase-functions-test": "^3.0.0"
echo   },
echo   "private": true
echo }
) > package.json
