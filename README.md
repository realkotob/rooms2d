# rooms2d

Try it on https://www.mossylogs.com/r/general

## How does it work?

The room name is the part after the /r/, so for example to go to a room called "game-dev", the link would be `https://www.mossylogs.com/r/game-dev`

You can **[add the Discord bot](https://discord.com/api/oauth2/authorize?client_id=797931723907268698&permissions=68672&scope=bot)** to your server to instantly create links with `!room`

Watch the Video Demo:

[![Watch the video](https://img.youtube.com/vi/I-PGKSYSXvc/maxresdefault.jpg)](https://youtu.be/I-PGKSYSXvc)


## Development

Clone the repository. Inside the newly created directory, run `npm install`. Also run `npm install` inside the client/ directory.

You need to setup SSL certificates or else microphone access doesn't work. You can put self-signed certificates in the certs/ directory for local testing ([how to setup self-signed certificates](https://www.ryangeddes.com/how-to-guides/linux/how-to-create-a-self-signed-ssl-certificate-on-linux/)). 

On your production server you need real certificates from Letsencrypt ([how to setup SSL with Letsencrypt](https://www.linode.com/docs/guides/install-lets-encrypt-to-create-ssl-certificates/)). Create a .env file and add the path to your SSL certificates. e.g. 
`CERT_PATH=/etc/letsencrypt/live/YOURWEBSITE.com/`

Run `sudo npm run start` to start the server (or `sudo npm run devStart` for faster development). You can access the app by navigating to https://localhost/.

Note. You need `sudo` or else you will not be able to use port 443 and the server will crash on launch.



