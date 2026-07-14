#!/usr/bin/env python3.13
"""
Configura los secrets SSH del VPS en GitHub Actions.

USO:
  python3.13 set-vps-secrets.py

Te pedirá interactivamente cada valor, o puedes pasarlos como argumentos:
  python3.13 set-vps-secrets.py --host 1.2.3.4 --user deploy --key-file ~/.ssh/id_ed25519 --path /opt/caliral --port 22
"""
import sys
import json
import os
import argparse
import requests
from base64 import b64encode
from nacl import encoding, public

REPO = "Sebasm2kuy/frimaral"
TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")

if not TOKEN:
    print("❌ Error: necesitas configurar GITHUB_TOKEN o GH_TOKEN en el entorno")
    print("   export GITHUB_TOKEN=ghp_xxx")
    sys.exit(1)

HEADERS = {
    "Accept": "application/vnd.github+json",
    "Authorization": f"token {TOKEN}",
    "X-GitHub-Api-Version": "2022-11-28",
}

def get_public_key():
    r = requests.get(f"https://api.github.com/repos/{REPO}/actions/secrets/public-key", headers=HEADERS)
    r.raise_for_status()
    return r.json()

def encrypt_secret(public_key_b64: str, secret_value: str) -> str:
    public_key = public.PublicKey(public_key_b64.encode("utf-8"), encoding.Base64Encoder())
    sealed_box = public.SealedBox(public_key)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return b64encode(encrypted).decode("utf-8")

def put_secret(name: str, value: str):
    pk = get_public_key()
    encrypted = encrypt_secret(pk["key"], value)
    payload = {"encrypted_value": encrypted, "key_id": pk["key_id"]}
    r = requests.put(
        f"https://api.github.com/repos/{REPO}/actions/secrets/{name}",
        headers=HEADERS,
        json=payload,
    )
    r.raise_for_status()
    print(f"  ✅ {name} configurado")

def main():
    parser = argparse.ArgumentParser(description="Configurar secrets SSH del VPS en GitHub Actions")
    parser.add_argument("--host", help="IP o dominio del VPS (ej: 123.45.67.89)")
    parser.add_argument("--user", default="deploy", help="Usuario SSH (default: deploy)")
    parser.add_argument("--key-file", help="Ruta al archivo de clave privada SSH (ej: ~/.ssh/id_ed25519)")
    parser.add_argument("--key-string", help="Contenido de la clave privada SSH (alternativa a --key-file)")
    parser.add_argument("--port", default="22", help="Puerto SSH (default: 22)")
    parser.add_argument("--path", default="/opt/caliral", help="Ruta de deploy en el VPS (default: /opt/caliral)")
    args = parser.parse_args()

    print("🔐 Configurando secrets SSH del VPS en GitHub Actions\n")

    # Obtener valores
    host = args.host or input("📡 IP o dominio de tu VPS (ej: 123.45.67.89 o midominio.com): ").strip()
    if not host:
        print("❌ Host es obligatorio")
        sys.exit(1)

    user = args.user or input("👤 Usuario SSH (default: deploy): ").strip() or "deploy"
    port = args.port or input("🔌 Puerto SSH (default: 22): ").strip() or "22"
    path = args.path or input("📁 Ruta de deploy (default: /opt/caliral): ").strip() or "/opt/caliral"

    # Clave privada
    key_content = None
    if args.key_string:
        key_content = args.key_string
    elif args.key_file:
        key_file = os.path.expanduser(args.key_file)
        with open(key_file, "r") as f:
            key_content = f.read()
    else:
        print("\n🔑 Clave privada SSH (pega el contenido completo, termina con una línea vacía):")
        lines = []
        while True:
            line = input()
            if line == "":
                break
            lines.append(line)
        key_content = "\n".join(lines)

    if not key_content or "PRIVATE KEY" not in key_content:
        print("❌ La clave privada no parece válida (debe contener 'PRIVATE KEY')")
        sys.exit(1)

    print(f"\n📤 Subiendo secrets a GitHub...\n")
    put_secret("SSH_HOST", host)
    put_secret("SSH_USER", user)
    put_secret("SSH_PORT", port)
    put_secret("DEPLOY_PATH", path)
    put_secret("SSH_PRIVATE_KEY", key_content)

    print(f"\n🎉 ¡Todos los secrets configurados!")
    print(f"\n📋 Resumen:")
    print(f"   VPS: {user}@{host}:{port}")
    print(f"   Path: {path}")
    print(f"\n🚀 Para desplegar ahora:")
    print(f"   git tag v1.0.0")
    print(f"   git push origin v1.0.0")
    print(f"\n   O ve a: https://github.com/{REPO}/actions/workflows/deploy-vps.yml")
    print(f"   Click en 'Run workflow'")

if __name__ == "__main__":
    main()
