# rooms2d

## Installing and running the game

Clone the repository. Inside the newly created directory, run `npm install`. Also run `npm install` inside the client directory.

You need to setup SSL certificates or else microphone access doesn't work. You can put self-signed certificates in the certs/ directory for local testing. On your production server create a .env file and add the path to your SSL certificates. The server will listen to connections on port `443`

Run `node server.js` to start the server. You can access the app by navigating to https://localhost/.



