# Rooms2D

Walk and talk with your friends -- directly in your browser! Features include shared youtube screen, 3D proximity audio, and minigames! 

[**Try it** now](https://www.mossylogs.com/r/general) in your browser or [**add the bot** to your Discord server](https://discord.com/api/oauth2/authorize?client_id=797931723907268698&permissions=8&redirect_uri=https%3A%2F%2Fdiscord.com%2Fapi%2Foauth2%2Fauthorize%3Fclient_id%3D797931723907268698%26permissions%3D68672%26scope%3Dbot&scope=bot)

Click to Watch the Video:

[![Watch the video](https://img.youtube.com/vi/I-PGKSYSXvc/maxresdefault.jpg)](https://youtu.be/I-PGKSYSXvc)

## How does it work?

The room name is after the /r/ so for example to go to a room called `game-dev` the link would be `https://www.mossylogs.com/r/game-dev`

You can also add the [**Discord bot**](https://discord.com/api/oauth2/authorize?client_id=797931723907268698&permissions=8&redirect_uri=https%3A%2F%2Fdiscord.com%2Fapi%2Foauth2%2Fauthorize%3Fclient_id%3D797931723907268698%26permissions%3D68672%26scope%3Dbot&scope=bot) to your server to instantly create links with `!room` ([repo](https://github.com/asheraryam/rooms2d-bot)).

## Controls


- Move with WASD, arrow keys, or mouse. 
- Press space to mute/unmute. 
- Right-click to throw the bouncy ball.


## Development

Clone the repository. Inside the newly created directory, run `npm install`. Also run `npm install` inside the client/ directory.

You need to setup SSL certificates or else microphone access doesn't work. You can put self-signed certificates in the certs/ directory for local testing ([how to setup self-signed certificates](https://www.ryangeddes.com/how-to-guides/linux/how-to-create-a-self-signed-ssl-certificate-on-linux/)). 

On your production server you need real certificates from Letsencrypt ([how to setup SSL with Letsencrypt](https://www.linode.com/docs/guides/install-lets-encrypt-to-create-ssl-certificates/)). Create a .env file and add the path to your SSL certificates. e.g. 
`CERT_PATH=/etc/letsencrypt/live/YOURWEBSITE.com/`

Run `sudo npm run start` to start the server (or `sudo npm run devStart` for faster development). You can access the app by navigating to https://localhost/.

Note. You need `sudo` or else you will not be able to use port 443 and the server will crash on launch.

The server also uses [pino-tee](https://github.com/pinojs/pino-tee) for logging, so you will need to install that in order to run the preset commands that are specified in `package.json`


