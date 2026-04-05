import requests, re
html = requests.get('https://specialwash.studio', timeout=20).text
m = re.search(r'static/js/main\.[a-f0-9]+\.js', html)
js_path = m.group(0) if m else ''
print('BUNDLE', js_path)
if js_path:
    js = requests.get('https://specialwash.studio/' + js_path, timeout=30).text
    checks = {
        'theme_toggle': 'sw-theme-toggle' in js,
        'fichar_text': ('Fichar' in js) or ('fichaje' in js.lower()),
        'photo_view': ('Ver foto' in js) or ('abrirFotoEvento' in js) or ('getSelfieEventoBlobUrl' in js),
        'trabajar_tambien': 'Trabajar tambien' in js,
    }
    for k,v in checks.items():
        print(k, v)
