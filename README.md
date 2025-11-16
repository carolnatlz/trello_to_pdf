# Trello_to_PDF
This project converts a Trello file (JSON) into a well-formatted PDF.

1. Dependencies (for mac):
```
brew install pandoc
brew install --cask mactex
```

2. Authentication for downloading images:

Access your Trello Account and get your key. Go to settings and find this:
<img width="600" height="300" alt="Screenshot 2025-11-16 at 19 08 24" src="https://github.com/user-attachments/assets/1aaff668-7ca8-406b-a161-ba0475e26f78" />

After that, input your key on this link to obtain your token without the brackets:
```
https://trello.com/1/authorize?expiration=never&name=PersonalToken&
scope=read,write,account&response_type=token&key={YOUR_KEY_HERE}
```
After allowing the permission request, it will return your token like this:

<img width="483" height="172" alt="Screenshot 2025-11-16 at 19 12 23" src="https://github.com/user-attachments/assets/8a0c70a1-ed84-41ec-9715-3e3f34a77ff5" />


To check if the API is reading accordingly and the token is valid, run this on your terminal and it shoud return your id and your username:

```
curl -sS "https://api.trello.com/1/members/me?key={YOUR_KEY_HERE}&token={YOUR_TOKEN_HERE}" | jq '.id, .username'
```

3. 
Trello's Authentication uses OAuth, so we must pass the key/token as parameters on the header.

