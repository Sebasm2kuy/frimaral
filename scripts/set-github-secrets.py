#!/usr/bin/env python3
"""
Sube secrets a GitHub Actions usando la API.
Usa el token PAT para autenticar y libsodium (pynacl) para encriptar.
"""
import sys
import json
import os
import requests
import secrets
import string
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
    """Obtiene la public key del repo para encriptar secrets."""
    r = requests.get(f"https://api.github.com/repos/{REPO}/actions/secrets/public-key", headers=HEADERS)
    r.raise_for_status()
    return r.json()

def encrypt_secret(public_key_b64: str, secret_value: str) -> str:
    """Encripta un secret con la public key del repo (libsodium sealed box)."""
    public_key = public.PublicKey(public_key_b64.encode("utf-8"), encoding.Base64Encoder())
    sealed_box = public.SealedBox(public_key)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return b64encode(encrypted).decode("utf-8")

def put_secret(name: str, value: str):
    """Sube un secret encriptado al repo."""
    pk = get_public_key()
    encrypted = encrypt_secret(pk["key"], value)
    payload = {
        "encrypted_value": encrypted,
        "key_id": pk["key_id"],
    }
    r = requests.put(
        f"https://api.github.com/repos/{REPO}/actions/secrets/{name}",
        headers=HEADERS,
        json=payload,
    )
    r.raise_for_status()
    print(f"  ✅ {name} configurado")
    return True

def generate_jwt_secret():
    """Genera un JWT secret seguro de 64 bytes."""
    return secrets.token_urlsafe(64)

def generate_password(length=32):
    """Genera un password fuerte."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))

def main():
    print("🔐 Configurando secrets en GitHub Actions...\n")

    # 1. JWT_SECRET - generado automáticamente
    jwt_secret = generate_jwt_secret()
    print(f"1. Generando JWT_SECRET (64 bytes aleatorio)...")
    put_secret("JWT_SECRET", jwt_secret)
    print(f"   Valor (guárdalo para referencia, aunque está en GitHub):")
    print(f"   {jwt_secret[:40]}...{jwt_secret[-10:]}\n")

    # 2. POSTGRES_PASSWORD - generado automáticamente
    pg_password = generate_password(32)
    print(f"2. Generando POSTGRES_PASSWORD (32 chars)...")
    put_secret("POSTGRES_PASSWORD", pg_password)
    print(f"   Valor: {pg_password[:8]}...{pg_password[-4:]}\n")

    # Guardar referencia local para el usuario
    with open("/home/z/my-project/download/secrets-generated.txt", "w") as f:
        f.write("# Secrets generados automáticamente para CALIRAL INSIGHT\n")
        f.write("# Estos valores ya están configurados en GitHub Actions\n")
        f.write("# Guárdalos en un lugar seguro (1Password, Bitwarden, etc.)\n\n")
        f.write(f"JWT_SECRET={jwt_secret}\n")
        f.write(f"POSTGRES_PASSWORD={pg_password}\n")

    print("📁 Valores completos guardados en: /home/z/my-project/download/secrets-generated.txt")
    print("\n⚠️  Secrets que faltan (requieren información de tu VPS):")
    print("   - SSH_HOST: IP o dominio de tu servidor (ej: 123.45.67.89)")
    print("   - SSH_USER: usuario SSH (ej: deploy)")
    print("   - SSH_PRIVATE_KEY: contenido completo de ~/.ssh/id_ed25519")
    print("   - SSH_PORT: puerto SSH (default: 22)")
    print("   - DEPLOY_PATH: ruta en el servidor (ej: /opt/caliral)")
    print("\n📝 Para configurar los secrets SSH, ejecuta el script:")
    print("   python3 /home/z/my-project/scripts/set-vps-secrets.py <valores>")

if __name__ == "__main__":
    main()
