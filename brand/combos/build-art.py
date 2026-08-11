"""Gera a arte dos cards de combo em client/public/combos/.

Como usar:
    python3 -m venv .venv && .venv/bin/pip install pillow
    .venv/bin/python brand/combos/build-art.py        # rode da raiz do repositório

O que ele faz: baixa a FOTO REAL de cada produto (a mesma que o catálogo mostra,
lida de server/src/db/products.js pelo SKU), tira o fundo branco, e monta os
produtos do combo apoiados na bancada de bancada.jpg — o chapado de estúdio, sem
objeto nenhum, gerado por IA e recolorido aqui para o cinza frio dos tokens.

Por que foto e não ilustração: o card é um anúncio de desconto, e o desconto é em
cima daqueles aparelhos. Desenho genérico obrigaria o cliente a confiar que o
"notebook" do desenho é o MacBook que ele vai receber. A foto é a mesma da página
do produto, então o card promete exatamente o que o carrinho entrega.

Refaça a arte quando as fotos do catálogo mudarem (`imagem_url` em products.js)
ou quando um combo passar a valer para outra categoria.
"""

import re
import sys
import tempfile
import urllib.request
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

RAIZ = Path(__file__).resolve().parents[2]
CATALOGO = RAIZ / 'server/src/db/products.js'
CHAPADO = Path(__file__).with_name('bancada.jpg')
SAIDA = RAIZ / 'client/public/combos'
CACHE = Path(tempfile.gettempdir()) / 'techlar-combo-art'

W, H = 1350, 900          # trabalha grande e reduz no fim: bordas mais limpas
BASE = int(H * 0.86)      # linha da bancada onde os produtos se apoiam
HORIZONTE = BASE - 62     # quina da bancada, atrás dos produtos
SUNK = (231, 235, 240)    # --paper-sunk
INK = (20, 27, 38)        # --ink

# Cada peça da cena é um SKU do catálogo mais a altura RELATIVA dentro do grupo.
# A escala não é a do mundo real: a impressora tem duas vezes e meia a altura do
# notebook aberto, e nessa proporção o notebook viraria um detalhe. Mantém só a
# hierarquia, e cada cena é escalada depois para preencher o espaço que tem.
PECAS = {
    'notebook': ('MacBookM4Air', 0.72),
    'celular': ('GSGH2J23213', 0.56),
    'impressora': ('IMP-3D-PREMIUM', 1.00),
}

# A ordem segue as categorias do combo em server/src/db/combos.js, que é a mesma
# ordem da trilha de nomes no card.
COMBOS = {
    'mesa-de-trabalho': ['notebook', 'celular'],
    'bancada-do-atelie': ['impressora', 'notebook'],
    'casa-inteira': ['notebook', 'celular', 'impressora'],
}


def foto(sku):
    """Baixa (uma vez) a foto do produto cujo SKU está no catálogo."""
    fonte = CATALOGO.read_text(encoding='utf-8')
    bloco = re.search(
        r"sku:\s*'" + re.escape(sku) + r"'.*?imagem_url:\s*'([^']+)'", fonte, re.S
    )
    if not bloco:
        raise SystemExit(f'SKU {sku} sem imagem_url em {CATALOGO.relative_to(RAIZ)}')
    url = bloco.group(1)
    if not url.startswith('http'):
        return RAIZ / 'client/public' / url.lstrip('/')

    CACHE.mkdir(parents=True, exist_ok=True)
    destino = CACHE / f'{sku}.img'
    if not destino.exists():
        pedido = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(pedido, timeout=30) as resposta:
            destino.write_bytes(resposta.read())
    return destino


def cutout(caminho, thresh=22):
    """Tira o fundo branco de foto de e-commerce.

    Preenchimento a partir dos quatro cantos em vez de corte por brilho: o branco
    de dentro da tela do produto não está ligado à borda, então continua opaco.
    """
    img = Image.open(caminho).convert('RGB')
    # Preenche com 0, longe do branco do fundo: o floodfill do Pillow compara a
    # cor de preenchimento com o pixel semente e desiste se a diferença couber no
    # thresh — preencher branco com branco não sairia do lugar.
    marca = img.convert('L').point(lambda v: 1 if v <= 1 else v)  # 0 fica reservado
    cantos = [(0, 0), (marca.width - 1, 0), (0, marca.height - 1), (marca.width - 1, marca.height - 1)]
    for canto in cantos:
        ImageDraw.floodfill(marca, canto, 0, thresh=thresh)
    alpha = marca.point(lambda v: 0 if v == 0 else 255)
    alpha = alpha.filter(ImageFilter.MinFilter(3))       # corrói 1px: mata a franja clara
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))  # e devolve borda macia
    img.putalpha(alpha)
    return img.crop(alpha.point(lambda v: 255 if v > 10 else 0).getbbox())


def altura(peca, alvo):
    escala = alvo / peca.height
    return peca.resize((max(1, round(peca.width * escala)), alvo), Image.LANCZOS)


def fundo():
    """Chapado recolorido para o cinza frio dos tokens, com bancada e luz."""
    bg = Image.open(CHAPADO).convert('RGB')
    corte = min(bg.width, int(bg.height * W / H))
    esq = (bg.width - corte) // 2
    bg = bg.crop((esq, 0, esq + corte, bg.height)).resize((W, H), Image.LANCZOS)
    # Recolore pela luminância: mantém o degradê parede/bancada da foto e joga a
    # matiz para o frio do site, em vez de confiar no cinza morno do chapado.
    bg = ImageOps.colorize(bg.convert('L'), black=(196, 205, 216), white=(250, 252, 253))

    vinheta = Image.new('L', (W, H), 0)
    ImageDraw.Draw(vinheta).ellipse(
        [-int(W * 0.30), -int(H * 0.55), int(W * 1.30), int(H * 1.35)], fill=255
    )
    vinheta = vinheta.filter(ImageFilter.GaussianBlur(180)).point(
        lambda v: 255 - int((255 - v) * 0.55)
    )
    bg = Image.composite(bg, Image.new('RGB', (W, H), (206, 214, 224)), vinheta)

    # A bancada precisa existir, senão o produto flutua no branco. Um tom abaixo
    # da parede, quina macia (não é aresta de estúdio duro) e mais escura na
    # beirada de baixo, onde a luz do teto já não chega.
    mesa = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mesa).rectangle([0, HORIZONTE, W, H], fill=255)
    bg = Image.composite(
        Image.new('RGB', (W, H), SUNK), bg, mesa.filter(ImageFilter.GaussianBlur(9))
    )

    beirada = Image.linear_gradient('L').resize((W, H - HORIZONTE)).point(lambda v: int(v * 0.55))
    faixa = Image.new('L', (W, H), 0)
    faixa.paste(beirada, (0, HORIZONTE))
    bg = Image.composite(Image.new('RGB', (W, H), (214, 221, 230)), bg, faixa)

    # Poça de luz atrás dos produtos: separa a mercadoria do chapado.
    poca = Image.new('L', (W, H), 0)
    ImageDraw.Draw(poca).ellipse([int(W * 0.13), int(H * 0.18), int(W * 0.87), HORIZONTE + 30], fill=120)
    return Image.composite(
        Image.new('RGB', (W, H), (252, 253, 254)), bg, poca.filter(ImageFilter.GaussianBlur(120))
    )


def sombra(canvas, peca, x, y):
    """Sombra em duas camadas: a difusa dá peso, a de contato cola na bancada.

    A de contato é bem mais estreita que a peça de propósito — do tamanho dela,
    virava uma barra escura atravessada embaixo do produto.
    """
    cx = x + peca.width // 2
    difusa = Image.new('L', canvas.size, 0)
    rw, rh = int(peca.width * 0.58), max(10, int(peca.height * 0.06))
    ImageDraw.Draw(difusa).ellipse([cx - rw, y - rh, cx + rw, y + rh + 8], fill=74)

    contato = Image.new('L', canvas.size, 0)
    rw2 = int(peca.width * 0.34)
    ImageDraw.Draw(contato).ellipse([cx - rw2, y - 5, cx + rw2, y + 6], fill=118)

    tinta = Image.new('RGB', canvas.size, INK)
    canvas.paste(tinta, (0, 0), difusa.filter(ImageFilter.GaussianBlur(30)))
    canvas.paste(tinta, (0, 0), contato.filter(ImageFilter.GaussianBlur(6)))


def reflexo(canvas, peca, x, y):
    """Reflexo curto e apagado: a bancada é fosca, então é só um sussurro."""
    virada = peca.transpose(Image.FLIP_TOP_BOTTOM)
    alto = max(2, int(peca.height * 0.16))
    virada = virada.crop((0, 0, virada.width, alto))
    esmaece = Image.linear_gradient('L').resize((virada.width, alto))
    esmaece = esmaece.point(lambda v: int((255 - v) * 0.17))  # forte no contato, zero no fim
    virada.putalpha(ImageChops.multiply(virada.getchannel('A'), esmaece))
    canvas.alpha_composite(virada.filter(ImageFilter.GaussianBlur(1.6)), (x, y + 2))


def compor(nome, chaves):
    canvas = fundo().convert('RGBA')
    cruas = [cutout(foto(PECAS[k][0])) for k in chaves]
    rel = [PECAS[k][1] for k in chaves]

    # Escala a cena para caber por LARGURA e por ALTURA: quem fecha primeiro manda.
    # Sem isso, o card de duas peças sobra vazio em cima e o de três estoura a
    # margem lateral, cada um com um enquadramento diferente.
    vao = int(W * 0.042)
    util = W - 2 * int(W * 0.055) - vao * (len(cruas) - 1)
    aspectos = [c.width / c.height for c in cruas]
    unidade = min(
        (BASE - int(H * 0.10)) / max(rel),
        util / sum(r * a for r, a in zip(rel, aspectos)),
    )
    pecas = [altura(c, max(1, round(r * unidade))) for c, r in zip(cruas, rel)]

    x = (W - (sum(p.width for p in pecas) + vao * (len(pecas) - 1))) // 2
    postos = []
    for p in pecas:
        postos.append((p, x))
        x += p.width + vao

    for p, px in postos:
        reflexo(canvas, p, px, BASE)
        sombra(canvas, p, px, BASE)
    for p, px in postos:
        canvas.alpha_composite(p, (px, BASE - p.height))

    # Sem trilha desenhada na foto: o card já tem a trilha de latão com o
    # percentual logo abaixo da imagem, ligando os nomes dos produtos. Duas
    # trilhas encostadas viram ruído, e a de baixo é a que carrega informação.
    #
    # JPEG, não PNG: a cena é fotográfica e cheia de degradê suave — em paleta, o
    # dithering aparecia como sujeira em volta das sombras.
    destino = SAIDA / f'{nome}.jpg'
    canvas.convert('RGB').resize((900, 600), Image.LANCZOS).save(
        destino, 'JPEG', quality=86, subsampling=1, optimize=True, progressive=True
    )
    return destino


if __name__ == '__main__':
    SAIDA.mkdir(parents=True, exist_ok=True)
    pedidos = sys.argv[1:] or list(COMBOS)
    for slug in pedidos:
        if slug not in COMBOS:
            raise SystemExit(f'combo desconhecido: {slug} (tem {", ".join(COMBOS)})')
        caminho = compor(slug, COMBOS[slug])
        print(f'{caminho.relative_to(RAIZ)}  {caminho.stat().st_size // 1024} KB')
