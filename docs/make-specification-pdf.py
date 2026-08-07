#!/usr/bin/env python3
"""Render docs/specification.md content as the BYKO specification PDF.

Output: website/ext/docs/specification.pdf
Run from the repository root:  python3 docs/make-specification-pdf.py

The content below mirrors docs/specification.md by hand — the markdown stays
the authoritative document; this script is the typesetting. Update both in
the same commit when the specification changes.
"""

import os

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, Image, KeepTogether,
                                NextPageTemplate, PageBreak, PageTemplate,
                                Paragraph, Spacer, Table, TableStyle)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "website", "assets", "fonts")
OUT = os.path.join(ROOT, "website", "ext", "docs", "specification.pdf")

VERSION = "1.1"
DATE = "2026-08-07"

BG = HexColor("#0B0D10")
TEXT = HexColor("#E8EAEE")
TEXT2 = Color(232 / 255, 234 / 255, 238 / 255, 0.72)
MUTED = Color(232 / 255, 234 / 255, 238 / 255, 0.45)
LINE = Color(1, 1, 1, 0.14)
LINE_SOFT = Color(1, 1, 1, 0.08)
ACCENT = HexColor("#7CCBFF")
PEACH = HexColor("#FFB088")

pdfmetrics.registerFont(TTFont("Inter", os.path.join(FONTS, "Inter-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Inter-SemiBold", os.path.join(FONTS, "Inter-SemiBold.ttf")))
pdfmetrics.registerFont(TTFont("Inter-ExtraLight", os.path.join(FONTS, "Inter-ExtraLight.ttf")))
pdfmetrics.registerFont(TTFont("Mono", os.path.join(FONTS, "JetBrainsMono-Regular.ttf")))

PAGE_W, PAGE_H = A4
MARGIN = 22 * mm

body = ParagraphStyle("body", fontName="Inter", fontSize=10, leading=15.5,
                      textColor=TEXT, spaceAfter=8)
lede = ParagraphStyle("lede", parent=body, fontSize=11.5, leading=18,
                      textColor=Color(232 / 255, 234 / 255, 238 / 255, 0.8))
h2 = ParagraphStyle("h2", fontName="Inter-SemiBold", fontSize=17, leading=21,
                    textColor=TEXT, spaceBefore=4, spaceAfter=10)
kicker = ParagraphStyle("kicker", fontName="Mono", fontSize=8.5, leading=12,
                        textColor=ACCENT, spaceAfter=5)
bullet = ParagraphStyle("bullet", parent=body, leftIndent=12, bulletIndent=2,
                        spaceAfter=6)
note = ParagraphStyle("note", fontName="Mono", fontSize=7.5, leading=12,
                      textColor=MUTED)


def mono(text, color="#8b9096", size=8.5):
    return f'<font face="Mono" size="{size}" color="{color}">{text}</font>'


def strong(text):
    return f'<font face="Inter-SemiBold">{text}</font>'


def peach(text, size=8.5):
    return f'<font face="Mono" size="{size}" color="#FFB088">{text}</font>'


def facts_table(rows, col0=118):
    data = []
    for key, value in rows:
        data.append([
            Paragraph(f'<font face="Mono" size="7" color="#6e7379">{key.upper()}</font>', note),
            Paragraph(value, body),
        ])
    table = Table(data, colWidths=[col0, PAGE_W - 2 * MARGIN - col0])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINE_SOFT),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def draw_mark(canvas, x, y, scale, color_bar=ACCENT, color_point=PEACH):
    """The |> mark: stroke 13 on a 96 canvas, butt caps, miter joins."""
    canvas.saveState()
    canvas.translate(x, y)
    canvas.scale(scale, -scale)
    canvas.setLineCap(0)
    canvas.setLineJoin(0)
    canvas.setLineWidth(13)
    canvas.setStrokeColor(color_bar)
    canvas.line(24, 14, 24, 82)
    canvas.setStrokeColor(color_point)
    path = canvas.beginPath()
    path.moveTo(40, 20)
    path.lineTo(70, 48)
    path.lineTo(40, 76)
    canvas.drawPath(path, stroke=1, fill=0)
    canvas.restoreState()


def page_background(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.75)
    canvas.rect(8 * mm, 8 * mm, PAGE_W - 16 * mm, PAGE_H - 16 * mm, stroke=1, fill=0)
    canvas.restoreState()


def content_page(canvas, doc):
    page_background(canvas, doc)
    canvas.saveState()
    canvas.setFont("Mono", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, 12.5 * mm, f"BYKO — SPECIFICATION V{VERSION}")
    canvas.drawRightString(PAGE_W - MARGIN, 12.5 * mm, f"{doc.page - 1:02d}")
    canvas.setStrokeColor(LINE_SOFT)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 16 * mm, PAGE_W - MARGIN, 16 * mm)
    canvas.restoreState()


def cover_page(canvas, doc):
    page_background(canvas, doc)
    canvas.saveState()
    draw_mark(canvas, PAGE_W / 2 - 51, PAGE_H - 130, 1.05)
    canvas.setFont("Inter-SemiBold", 34)
    canvas.setFillColor(TEXT)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 262, "BYKO")
    canvas.setFont("Mono", 9)
    canvas.setFillColor(ACCENT)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 288, "S P E C I F I C A T I O N")
    canvas.setFont("Inter-ExtraLight", 58)
    canvas.setFillColor(PEACH)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 380, "790,227")
    canvas.setFont("Mono", 8)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 402, "FIXED SUPPLY · GENESIS ERC-20 · BASE / CHAIN 8453")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(PAGE_W / 2 - 60, PAGE_H - 430, PAGE_W / 2 + 60, PAGE_H - 430)
    canvas.setFont("Mono", 8.5)
    canvas.setFillColor(TEXT2)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 455, f"Version {VERSION} · {DATE}")
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 472, "0x078bB16e24c8931fc007928c370422e5e38F4372")
    canvas.setFont("Mono", 8)
    canvas.drawCentredString(PAGE_W / 2, 60, "byko.bykovas.lt · github.com/bykovas/byko")
    canvas.drawCentredString(PAGE_W / 2, 46, "1 BYKO = 1 BYKO")
    canvas.restoreState()


def section(number, title):
    return [
        Spacer(1, 10),
        Paragraph(f"—— {number:02d} / {title.upper()}", kicker),
    ]


ADDRESS = "0x078bB16e24c8931fc007928c370422e5e38F4372"

story = []
story.append(NextPageTemplate("content"))
story.append(PageBreak())

story.append(Paragraph(
    "This document describes the BYKO token and the systems around it. Where this "
    "document and the deployed contract disagree, the contract prevails — the contract "
    "is the specification; this is its description. The document is versioned in the "
    "repository; every change is a commit and therefore traceable.", lede))
story.append(Spacer(1, 6))

story += section(1, "Token")
story.append(Paragraph("The token", h2))
story.append(facts_table([
    ("Name", "BYKO"),
    ("Symbol", mono("BYKO", "#E8EAEE")),
    ("Standard", "ERC-20 — OpenZeppelin Contracts 5.4.0, unmodified"),
    ("Decimals", mono("18", "#E8EAEE")),
    ("Total supply", peach("790,227 BYKO") + mono("  = 790_227 × 10^18 base units, fixed")),
    ("Network", "Base (OP-stack L2 on Ethereum)"),
    ("Chain ID", mono("8453", "#E8EAEE")),
    ("Contract", mono(ADDRESS, "#E8EAEE", 8)),
]))
story.append(Spacer(1, 8))
story.append(Paragraph(
    "The entire supply is minted once, in the constructor, to the deployer. The contract "
    f"adds a single public constant ({mono('MAX_SUPPLY')}) on top of the inherited ERC-20 "
    "and nothing else. The source is 21 lines.", body))

story += section(2, "Invariants")
story.append(Paragraph("What cannot change", h2))
for head, text in [
    ("Supply is fixed.", "No mint function exists after the constructor. No burn function "
     "is provided; transfers to the zero address are rejected by OpenZeppelin's checks."),
    ("Nobody is in charge.", "No owner, no admin role, no pause switch, no allowlist or "
     "blocklist, no transfer tax, no fees."),
    ("The code is final.", "No proxy, no upgrade path. What was deployed is what runs, forever."),
    ("The source is public.", "Verified on BaseScan with an exact match against the deployed bytecode."),
]:
    story.append(Paragraph(f"·&nbsp;&nbsp;{strong(head)} {text}", bullet))

story += section(3, "Deployment record")
story.append(Paragraph("Deployed and done", h2))
story.append(facts_table([
    ("Creation tx", mono("0xeac11a3210328c21d1c96bb1c7dafbfdcb2f4a51b510049fa3cdf232b64b9378", "#E8EAEE", 7.5)),
    ("Block", mono("49,430,937", "#E8EAEE")),
    ("Date", "2 Aug 2026"),
    ("Deployer", mono("omenas.base.eth", "#E8EAEE")),
    ("Compiler", "solc v0.8.34, optimizer default"),
    ("Verification", "BaseScan — Source Code Verified, exact match"),
]))

story += section(4, "Genesis distribution")
story.append(Paragraph("One mint, split once", h2))
story.append(facts_table([
    ("Liquidity pool", peach("740,227 BYKO") + mono("  93.7%")),
    ("Founder", peach("50,000 BYKO") + mono("  6.3%")),
    ("Total", peach("790,227 BYKO") + mono("  100%")),
]))
story.append(Spacer(1, 8))
story.append(Paragraph("Pool funding tx: " +
    mono("0xc1ea5195a255df6ad0439b106fcd575a3e98fc2d43b3a94adb7935f45b3337f2", size=7.5), body))

story.append(PageBreak())
story += section(5, "Market")
story.append(Paragraph("The pool, on the chain", h2))
story.append(facts_table([
    ("Pool", "BYKO/USDC on Aerodrome (Base)"),
    ("Pool address", mono("0x02dd4285ad38ea93d021ca854016a839b0b2a6ca", "#E8EAEE", 8)),
    ("Genesis ratio", mono("740,227 BYKO : 74.0227 USDC", "#E8EAEE")),
    ("USDC contract", mono("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", size=8) + mono("  6 decimals")),
]))
story.append(Spacer(1, 8))
story.append(Paragraph(
    "The website reads price and reserves directly from the chain "
    f"({mono('balanceOf(pool)')} on both tokens); no third-party price APIs are involved.", body))
story.append(Paragraph(
    f"{strong('The liquidity position is permanently locked.')} All LP tokens of the pool "
    f"were sent to the burn address ({mono('0x…dEaD')}) in two transactions on 7 Aug 2026, "
    "so the pooled liquidity cannot be withdrawn by anyone:", body))
story.append(facts_table([
    ("Burn 1 · 3.07%", mono("0x176dbc759894fa605c78e95bc7b61f0254005358fed20ee70ef85b0c657d5476", "#E8EAEE", 7.5)),
    ("Burn 2 · 96.93%", mono("0xe47921b2208c15c8b2f95f07be37aa70269b46c7a38f7363817af8258da584c6", "#E8EAEE", 7.5)),
], col0=95))
story.append(Spacer(1, 8))
story.append(Paragraph(
    "Live proof: the pool token's holder list on BaseScan shows the burn address at 100%. "
    "Nothing else in this section is a promise of liquidity or price.", body))

story += section(6, "Donation cards")
story.append(Paragraph("A card, on the record", h2))
story.append(Paragraph(
    "A voluntary donation of BYKO can be recorded as a numbered certificate — a donation card.", body))
for head, text in [
    ("Donation address.", mono("0x42873C60bC22424dBB4518DF7bE8b7F9eF4ac1D6", size=8) +
     f" — any BYKO {mono('Transfer')} to this address in a successful transaction at or after "
     f"block {mono('49,614,625', '#E8EAEE')} is eligible; earlier transfers are not."),
    ("Issuance.", "The card service verifies the transaction receipt on Base, reads the "
     "transferred amount (the nominal) and the block timestamp (the date), and issues a "
     f"serial in the form {mono('BK 0000001', '#E8EAEE')}. Issuance is idempotent per "
     "transaction hash: one tx, one card, forever."),
    ("Contents.", "Serial, nominal, date, transaction hash, an optional inscription supplied "
     "by the donor (at most 300 characters), and a bearer contact. On the public page the "
     "bearer contact is masked."),
    ("Permanence.", f"Each card is permanently available at {mono('/card/{serial}')} on the "
     "project site. One notification letter is sent to the bearer per card."),
]:
    story.append(Paragraph(f"·&nbsp;&nbsp;{strong(head)} {text}", bullet))
story.append(Paragraph(
    "A card confers no rights, no yield and no claim on anything. It records that a donation "
    "happened. That is all it does.", body))

story.append(PageBreak())
story += section(7, "Public read APIs")
story.append(Paragraph("Best effort, no SLA", h2))
story.append(facts_table([
    ("GET /api/holders", "Holder count and supply distribution across BaseScan-style tiers "
     "(whale ≥ 10% of supply, then decades down: shark 1–10%, dolphin 0.1–1%, fish 0.01–0.1%, "
     f"crab 0.001–0.01%, shrimp &lt; 0.001%), computed from on-chain {mono('Transfer')} logs."),
    ("GET /card/{serial}", "The donation card, as SVG."),
], col0=110))
story.append(Spacer(1, 8))
story.append(Paragraph("These endpoints read chain state and never write to it.", body))

story += section(8, "Versioning")
story.append(Paragraph("Every change is a commit", h2))
story.append(Paragraph(
    f"This specification lives at {mono('docs/specification.md')} in the "
    f"{mono('github.com/bykovas/byko')} repository, and this PDF is generated from it by a "
    "script versioned alongside. Changes are made by commit only, so the full history of "
    "every revision is public.", body))
story.append(facts_table([
    ("1.1 · 2026-08-07", "LP burn recorded: pool liquidity permanently locked"),
    ("1.0 · 2026-08-06", "Initial specification"),
], col0=110))

story.append(Spacer(1, 22))
story.append(Paragraph(
    "BYKO IS A TOKEN WITH NO UTILITY, NO YIELD AND NO PROMISES. IT DOES NOT REPRESENT EQUITY, "
    "DEBT OR ANY CLAIM ON ANYTHING. NOTHING IN THIS DOCUMENT IS FINANCIAL ADVICE. VERIFY THE "
    "CONTRACT ON BASESCAN BEFORE INTERACTING. 1 BYKO = 1 BYKO.", note))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
doc = BaseDocTemplate(OUT, pagesize=A4,
                      title=f"BYKO — Specification v{VERSION}",
                      author="BYKO", subject="BYKO token specification",
                      creator="docs/make-specification-pdf.py")
frame = Frame(MARGIN, 20 * mm, PAGE_W - 2 * MARGIN, PAGE_H - 20 * mm - 18 * mm, id="main")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame], onPage=cover_page),
    PageTemplate(id="content", frames=[frame], onPage=content_page),
])
doc.build(story)
print("wrote", OUT)
