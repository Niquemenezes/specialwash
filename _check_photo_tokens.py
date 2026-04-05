import requests, re
html = requests.get('https://specialwash.studio', timeout=20).text
js_path = re.search(r'static/js/main\.[a-f0-9]+\.js', html).group(0)
js = requests.get('https://specialwash.studio/' + js_path, timeout=30).text
for token in ['/selfie', '/api/horarios/registro/', 'selfie_url', 'registro_horario', 'blob']:
    print(token, token in js)
