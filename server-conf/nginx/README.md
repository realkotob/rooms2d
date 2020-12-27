

These settings were mostly adapted from https://www.linkedin.com/pulse/how-use-nginx-reverse-proxy-https-wss-self-signed-ramos-da-silva/?articleId=6678584723419226112

### Step 1 - Install Nginx and Basic Configuration

So, we can use Nginx as a reverse proxy to get all your requests on your DNS or IP on port 80 and 433 to your applications. 

First of all let’s install Nginx:

sudo apt-get install nginx
sudo service nginx start

Check that the service is running by tipping:

sudo service nginx status

You will also want to enable Nginx, so it starts when your server boots:

sudo systemctl enable nginx

Add the following rules on the IP tables of your servers

sudo iptables -I INPUT -p tcp -m tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp -m tcp --dport 443 -j ACCEPT
