import os

base = "d:\\Users\ultimateai\src\ui\simulator"
base = r"d:\Users\ultimateai\src\ui\simulator"
for root, dirs, files in os.walk(base):
    for f in files:
        if f.endswith(('.jsx', '.js', '.mjs', '.ts', '.tsx', '.css', '.scss')):
            print(os.path.join(root, f))
