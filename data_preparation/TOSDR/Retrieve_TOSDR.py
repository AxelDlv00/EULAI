# ╔════════════════════════════════════════════════════════╗
# ║            Retrieve the dataset from ToS;DR            ║
# ╚════════════════════════════════════════════════════════╝

# ╭────────────────────────────────────────────────────────╮
# │                        Packages                        │
# ╰────────────────────────────────────────────────────────╯

import requests
import json
import time
import random
import concurrent.futures
from pathlib import Path

from rich import print as rprint
from rich.panel import Panel
from rich.console import Console
from rich.progress import (
    Progress, SpinnerColumn, BarColumn, TextColumn, 
    TimeRemainingColumn, MofNCompleteColumn
)

# ╭────────────────────────────────────────────────────────╮
# │                    Global variables                    │
# ╰────────────────────────────────────────────────────────╯

# Configuration
console = Console()
API_BASE = "https://api.tosdr.org"

# User-Agents pour passer inaperçu
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

ROOT = Path(".") 
DATA_DIR = ROOT / "data" / "TOSDR"
DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_FILE = DATA_DIR / "tosdr_links_only.json"

def safe_get(url, retries=3, backoff=5):
    """Requête GET simple et rapide."""
    headers = {'User-Agent': random.choice(USER_AGENTS)}
    for i in range(retries):
        try:
            # Délai très court car on fait des requêtes légères
            time.sleep(random.uniform(0.1, 0.3)) 
            resp = requests.get(url, headers=headers, timeout=10)
            
            if resp.status_code == 429:
                wait = backoff * (i + 1)
                # On attend silencieusement sauf si c'est long
                if wait > 10:
                    console.print(f"[red]⚡ Pause 429 ({wait}s)...[/red]")
                time.sleep(wait)
                continue
                
            if resp.status_code == 200:
                return resp
        except:
            time.sleep(1)
    return None

def fetch_service_index():
    """Récupère rapidement tous les IDs via la pagination V3"""
    valid_ids = []
    page = 1
    empty_count = 0
    
    console.print("[cyan]Phase 1 : Récupération de la liste des services...[/cyan]")
    
    with console.status("Scan de l'index...") as status:
        while True:
            resp = safe_get(f'{API_BASE}/service/v3/?page={page}')
            if not resp: break
            
            try:
                data = resp.json()
                # Gestion souple de la structure de réponse
                if isinstance(data, list):
                    services = data
                else:
                    services = data.get('parameters', {}).get('services', [])
                    if not services: services = data.get('services', [])
                
                if not services:
                    empty_count += 1
                    if empty_count >= 3: break
                else:
                    empty_count = 0
                    for s in services:
                        if isinstance(s, dict) and s.get('id'):
                            valid_ids.append(s['id'])
                
                status.update(f"Page {page} - {len(valid_ids)} services trouvés")
                page += 1
            except:
                break
                
    unique_ids = sorted(list(set(valid_ids)))
    console.print(f"[green]✔ Index terminé : {len(unique_ids)} services uniques.[/green]")
    return unique_ids

def fetch_service_lite(service_id):
    """
    Récupère uniquement les métadonnées et les LIENS des documents.
    Ne télécharge pas le texte.
    """
    resp = safe_get(f"{API_BASE}/service/v3/?id={service_id}")
    if not resp: return None
    
    try:
        raw = resp.json()
        data = raw.get('parameters', raw)
        
        if not data.get('name'): return None

        # Extraction simple des liens
        docs = []
        for d in data.get('documents', []):
            if d.get('url'):
                docs.append({
                    "title": d.get('name', 'Unknown'),
                    "url": d.get('url')
                })

        return {
            "id": service_id,
            "name": data.get('name'),
            "rating": data.get('rating', {}).get('human', 'N/A') if isinstance(data.get('rating'), dict) else data.get('rating', 'N/A'),
            "urls": docs
        }
    except:
        return None

if __name__ == "__main__":
    console.print(Panel("[bold]ToS;DR Lite Scraper (URLs Only)[/bold]", border_style="blue"))
    
    # 1. Obtenir les IDs
    all_ids = fetch_service_index()
    
    if not all_ids:
        console.print("[red]Erreur fatale : Impossible de récupérer l'index.[/red]")
        exit()

    results = []
    
    # 2. Extraction Rapide
    progress = Progress(
        SpinnerColumn(),
        BarColumn(),
        MofNCompleteColumn(),
        TimeRemainingColumn(),
        TextColumn("[green]{task.fields[speed]} items/s[/green]"),
        console=console
    )

    with progress:
        task = progress.add_task("Récupération des URLs...", total=len(all_ids), speed=0)
        
        # On peut monter à 5 workers car les requêtes sont légères (pas de parsing lourd)
        start_time = time.time()
        completed = 0
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            future_to_id = {executor.submit(fetch_service_lite, i): i for i in all_ids}
            
            for future in concurrent.futures.as_completed(future_to_id):
                res = future.result()
                if res:
                    results.append(res)
                
                completed += 1
                progress.update(task, advance=1)
                
                # Calcul vitesse
                elapsed = time.time() - start_time
                if elapsed > 0:
                    speed = completed / elapsed
                    progress.update(task, speed=f"{speed:.1f}")

    # Sauvegarde
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    console.print(f"\n[bold green]✔ Terminé ! {len(results)} services sauvegardés dans {OUTPUT_FILE}[/bold green]")
    
    # Aperçu
    if results:
        console.print("\n[dim]Exemple de résultat :[/dim]")
        rprint(results[0])