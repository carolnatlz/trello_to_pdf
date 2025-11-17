# Transform Trello's Cards into PDF files
This project converts a Trello file (JSON) into a well-formatted PDF.

1. Dependencies (for mac):
```
brew install pandoc
brew install --cask mactex
```
Besides that we will use the Terminal and Powershell

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

3. Download Trello's Card in JSON format

Go to your trello card and enter "Share" them click "Export JSON" and save it with this name: "trello.json"

<img width="227" height="309" alt="Screenshot 2025-11-16 at 21 34 34" src="https://github.com/user-attachments/assets/f3c1e48d-6ddf-4ee6-b85d-41b374f266a4" />

<img width="315" height="180" alt="Screenshot 2025-11-16 at 21 34 55" src="https://github.com/user-attachments/assets/ff06b995-e0b2-4209-9635-915f50368795" />

-----------

4. Run Scripts

Open PowerShell, certifying you are in the correct folder (that has your trello.json file) and run the following command:

```
$json = Get-Content "trello.json" -Raw | ConvertFrom-Json

$json.actions.data.text |
    Where-Object { $_ } |
    ForEach-Object { $_.Replace("trello", "api.trello") } |
    Out-File "trello-output.txt" -Encoding utf8
```

After this moment you should have a "trello-output.txt" file saved on the this same folder.

5. PDF Conversion

Finally, we will authenticate and convert the txt file into a PDF. 
Trello's Authentication uses OAuth, so we must pass the key/token as parameters on the header. So, just run this on terminal:

```
export TRELLO_KEY="{YOUR_KEY_HERE}"
export TRELLO_TOKEN="{YOUR_TOKEN_HERE}"
node trello2pdf.js --txt trello-output.txt --out trello-card.pdf --font "Arial" --keep-md
```



