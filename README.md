# rooms2d

## Installing and running the game

Clone the repository. Inside the newly created directory, run `npm install`. Also run `npm install` inside the client directory.

You need to setup SSL certificates or else microphone access doesn't work. You can put self-signed certificates in the certs/ directory for local testing ([how to setup self-signed certificates](https://www.ryangeddes.com/how-to-guides/linux/how-to-create-a-self-signed-ssl-certificate-on-linux/)). 

On your production server you need real certificates from Letsencrypt ([how to setup SSL with Letsencrypt](https://www.linode.com/docs/guides/install-lets-encrypt-to-create-ssl-certificates/)). Create a .env file and add the path to your SSL certificates. e.g. 
`CERT_PATH=/etc/letsencrypt/live/YOURWEBSITE.com/`

Run `node server.js` to start the server. You can access the app by navigating to https://localhost/. The server will listen to connections on port `443`.



