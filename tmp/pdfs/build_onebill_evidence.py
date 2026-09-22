from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table,
    TableStyle, PageBreak, KeepTogether, Flowable, Image
)
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "ONEBILL_VPN_EVIDENCE_PACK_2026-09-17.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)
PANOS_GUI = ROOT / "tmp" / "pdfs" / "panos_gui" / "rendered" / "landscape2-1.png"

NAVY = colors.HexColor("#0B1F33")
BLUE = colors.HexColor("#1565C0")
CYAN = colors.HexColor("#00A6C8")
GREEN = colors.HexColor("#16856B")
LIGHT_GREEN = colors.HexColor("#E8F5F0")
RED = colors.HexColor("#C53030")
LIGHT_RED = colors.HexColor("#FDECEC")
ORANGE = colors.HexColor("#E57C23")
LIGHT_ORANGE = colors.HexColor("#FFF3E6")
LIGHT_BLUE = colors.HexColor("#EAF3FC")
MID_GREY = colors.HexColor("#5B6775")
LIGHT_GREY = colors.HexColor("#F3F5F7")
LINE = colors.HexColor("#CBD3DA")
WHITE = colors.white
BLACK = colors.HexColor("#111820")


class StatusBadge(Flowable):
    def __init__(self, text, bg, width=42*mm, height=9*mm):
        super().__init__()
        self.text = text
        self.bg = bg
        self.width = width
        self.height = height

    def draw(self):
        self.canv.setFillColor(self.bg)
        self.canv.roundRect(0, 0, self.width, self.height, 2.5*mm, fill=1, stroke=0)
        self.canv.setFillColor(WHITE)
        self.canv.setFont("Helvetica-Bold", 9)
        self.canv.drawCentredString(self.width/2, 3.0*mm, self.text)


class TerminalCapture(Flowable):
    def __init__(self, title, lines, width=174*mm, font_size=7.2,
                 highlight_terms=None, label="SANITIZED LIVE CAPTURE"):
        super().__init__()
        self.title = title
        self.lines = lines
        self.width = width
        self.font_size = font_size
        self.line_height = font_size * 1.40
        self.header_h = 12*mm
        self.pad = 4*mm
        self.height = self.header_h + self.pad*1.3 + len(lines)*self.line_height + self.pad
        self.highlight_terms = highlight_terms or []
        self.label = label

    def wrap(self, availWidth, availHeight):
        return min(self.width, availWidth), self.height

    def draw(self):
        c = self.canv
        w = self.width
        h = self.height
        c.setFillColor(colors.HexColor("#101820"))
        c.roundRect(0, 0, w, h, 2.5*mm, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#1E2A35"))
        c.roundRect(0, h-self.header_h, w, self.header_h, 2.5*mm, fill=1, stroke=0)
        c.rect(0, h-self.header_h, w, self.header_h-2.5*mm, fill=1, stroke=0)
        for i, col in enumerate(("#FF5F56", "#FFBD2E", "#27C93F")):
            c.setFillColor(colors.HexColor(col))
            c.circle(4.8*mm+i*5.0*mm, h-6.0*mm, 1.45*mm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(21*mm, h-7.7*mm, self.title)
        c.setFillColor(colors.HexColor("#8DA2B5"))
        c.setFont("Helvetica", 6.5)
        c.drawRightString(w-4*mm, h-7.7*mm, self.label)

        y = h-self.header_h-self.pad
        c.setFont("Courier", self.font_size)
        for line in self.lines:
            color = colors.HexColor("#D8E2EA")
            for term, term_color in self.highlight_terms:
                if term in line:
                    color = term_color
                    break
            c.setFillColor(color)
            c.drawString(self.pad, y, line)
            y -= self.line_height


def P(text, style="BodyText"):
    return Paragraph(text, styles[style])


def evidence_table(rows, widths, header=True, font=8.3):
    data = []
    for ridx, row in enumerate(rows):
        converted = []
        for cell in row:
            if isinstance(cell, Flowable):
                converted.append(cell)
            else:
                style = "TableHead" if header and ridx == 0 else "TableBody"
                converted.append(P(str(cell), style))
        data.append(converted)
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("GRID", (0,0), (-1,-1), 0.35, LINE),
    ]
    if header:
        commands += [
            ("BACKGROUND", (0,0), (-1,0), NAVY),
            ("TEXTCOLOR", (0,0), (-1,0), WHITE),
        ]
        start = 1
    else:
        start = 0
    for i in range(start, len(data)):
        if (i-start) % 2 == 1:
            commands.append(("BACKGROUND", (0,i), (-1,i), LIGHT_GREY))
    t.setStyle(TableStyle(commands))
    return t


def callout(title, body, color=BLUE, bg=LIGHT_BLUE):
    t = Table([
        ["", P(f"<b>{title}</b><br/>{body}", "Callout")]
    ], colWidths=[3*mm, 166*mm], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg),
        ("BACKGROUND", (0,0), (0,0), color),
        ("BOX", (0,0), (-1,-1), 0.4, color),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (1,0), (1,0), 8),
        ("RIGHTPADDING", (1,0), (1,0), 8),
        ("TOPPADDING", (1,0), (1,0), 8),
        ("BOTTOMPADDING", (1,0), (1,0), 8),
    ]))
    return t


def section_label(text):
    return Table([[P(text.upper(), "SectionLabel")]], colWidths=[174*mm], hAlign="LEFT",
                 style=TableStyle([
                     ("BACKGROUND", (0,0), (-1,-1), LIGHT_BLUE),
                     ("LINEBELOW", (0,0), (-1,-1), 1.2, BLUE),
                     ("LEFTPADDING", (0,0), (-1,-1), 6),
                     ("RIGHTPADDING", (0,0), (-1,-1), 6),
                     ("TOPPADDING", (0,0), (-1,-1), 4),
                     ("BOTTOMPADDING", (0,0), (-1,-1), 4),
                 ]))


def header_footer(c: canvas.Canvas, doc):
    c.saveState()
    page = c.getPageNumber()
    c.setFillColor(NAVY)
    c.rect(0, A4[1]-16*mm, A4[0], 16*mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(18*mm, A4[1]-10.2*mm, "1BILL VPN EVIDENCE PACK")
    c.setFont("Helvetica", 7.5)
    c.drawRightString(A4[0]-18*mm, A4[1]-10.2*mm, "Zynotch / Fintap - 17 Sep 2026")
    c.setStrokeColor(LINE)
    c.line(18*mm, 15*mm, A4[0]-18*mm, 15*mm)
    c.setFillColor(MID_GREY)
    c.setFont("Helvetica", 7)
    c.drawString(18*mm, 9.5*mm, "Sanitized: no PSK, private keys, API credentials, or IPsec key material")
    c.drawRightString(A4[0]-18*mm, 9.5*mm, f"Page {page}")
    c.restoreState()


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=26, leading=30, textColor=NAVY, spaceAfter=6*mm, alignment=TA_LEFT
))
styles.add(ParagraphStyle(
    name="CoverSub", parent=styles["Normal"], fontName="Helvetica",
    fontSize=12, leading=17, textColor=MID_GREY, spaceAfter=4*mm
))
styles.add(ParagraphStyle(
    name="H1X", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=17, leading=21, textColor=NAVY, spaceBefore=2*mm, spaceAfter=4*mm
))
styles.add(ParagraphStyle(
    name="H2X", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=11.5, leading=15, textColor=BLUE, spaceBefore=3*mm, spaceAfter=2*mm
))
styles.add(ParagraphStyle(
    name="BodyX", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9.2, leading=13.2, textColor=BLACK, spaceAfter=2.4*mm
))
styles.add(ParagraphStyle(
    name="Small", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=7.5, leading=10.2, textColor=MID_GREY, spaceAfter=1.5*mm
))
styles.add(ParagraphStyle(
    name="TableHead", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=7.8, leading=10, textColor=WHITE
))
styles.add(ParagraphStyle(
    name="TableBody", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=7.8, leading=10.2, textColor=BLACK
))
styles.add(ParagraphStyle(
    name="Callout", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9, leading=13, textColor=BLACK
))
styles.add(ParagraphStyle(
    name="SectionLabel", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=7.2, leading=9, textColor=BLUE, tracking=0.7
))
styles.add(ParagraphStyle(
    name="BulletX", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9, leading=13, leftIndent=5*mm, firstLineIndent=-3*mm,
    bulletIndent=1*mm, spaceAfter=1.5*mm, textColor=BLACK
))


frame = Frame(18*mm, 19*mm, A4[0]-36*mm, A4[1]-39*mm, id="main", leftPadding=0,
              rightPadding=0, topPadding=2*mm, bottomPadding=0)
doc = BaseDocTemplate(
    str(OUT), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm,
    topMargin=20*mm, bottomMargin=19*mm,
    title="1BILL VPN Evidence Pack - Fintap Endpoint Validation",
    author="Zynotch PVT Limited"
)
doc.addPageTemplates(PageTemplate(id="evidence", frames=[frame], onPage=header_footer))

story = []

# Cover / executive page
story += [Spacer(1, 14*mm), StatusBadge("EVIDENCE COMPLETE", GREEN), Spacer(1, 8*mm)]
story += [P("1BILL VPN Evidence Pack", "CoverTitle")]
story += [P("Fintap endpoint validation, Palo Alto interoperability test, and production fault-domain proof", "CoverSub")]
story += [Spacer(1, 3*mm)]
meta = evidence_table([
    ["Prepared for", "1LINK / 1BILL network and security teams"],
    ["Prepared by", "Zynotch PVT Limited - Fintap"],
    ["Evidence date", "17 September 2026 (PKT); server captures include timezone offsets"],
    ["Production peer", "1LINK 103.248.140.4 <-> Fintap 178.238.236.126"],
    ["Scope", "IKEv2 Phase 1 does not establish in production"],
], [36*mm, 138*mm], header=False)
story += [meta, Spacer(1, 7*mm)]
story += [callout(
    "Executive finding",
    "The Fintap endpoint receives and correctly answers a real Palo Alto IKEv2 initiation using the exact 1BILL Phase 1 proposal. In production, Fintap has received <b>zero</b> packets from the documented 1LINK peer IP. The current production failure is therefore before PSK authentication, IKE identities, proxy IDs, or Phase 2.",
    GREEN, LIGHT_GREEN
), Spacer(1, 5*mm)]

headline = evidence_table([
    ["Control", "Observed result", "Meaning"],
    ["Fuel Palo Alto -> Fintap", "9 IKE_SA_INIT requests received; 9 responses sent", "Fintap listener, route and responder work"],
    ["Exact IKE proposal", "AES-256 / SHA-256 / PRF-SHA256 / group 19 selected", "The 1BILL document proposal is accepted"],
    ["Production 1LINK -> Fintap", "0 inbound packets from 103.248.140.4", "Production never reaches crypto/auth evaluation"],
    ["Fintap -> production 1LINK", "29 IKE packets sent with no received reply", "Peer/path does not answer"],
    ["Independent control SA", "Established with same algorithm suite", "StrongSwan and kernel IPsec path are functional"],
], [43*mm, 58*mm, 73*mm])
story += [headline, Spacer(1, 5*mm)]
story += [P("Confidence boundary", "H2X")]
story += [P("95% confidence that the Fintap VPN host is functioning and the production block is on the 1LINK-controlled side or the network/security path observable by 1LINK. The exact 1LINK device or rule cannot be named until 1LINK supplies an Untrust capture and ikemgr log from the active firewall.", "BodyX")]
story += [PageBreak()]

# Page 2 - actual PAN-OS GUI evidence
story += [section_label("Palo Alto GUI evidence - actual Fuel VM capture")]
story += [P("Actual PAN-OS 11.1.4 dashboard evidence", "H1X")]
story += [P("The image below is a direct print export of the live Palo Alto VM-Series GUI used in the Fuel interoperability test. It is not a mock-up and it is not represented as a screenshot from 1LINK's production firewall. The full image is retained so the PAN-OS navigation, device model/version and contemporaneous system-log context remain visible.", "BodyX")]

gui_image = Image(str(PANOS_GUI), width=174*mm, height=123*mm)
gui_image.hAlign = "LEFT"
story += [gui_image, Spacer(1, 2*mm)]
story += [P("Figure 1. Fuel PAN-OS VM-Series dashboard after the IKEv2 test. The System Logs panel visibly records a stale IKEv2 child SA and 'retransmission count exceeded the limit'.", "Small")]

gui_rows = [
    ["Visible GUI evidence", "Technical meaning"],
    ["Software Version 11.1.4", "The test used a current PAN-OS interface, not an obsolete GUI simulation."],
    ["Deleting a possible stale IKEv2 child SA", "PAN-OS created IKEv2 state for the test attempt."],
    ["retransmission count exceeded the limit", "The initiator did not accept/receive the return exchange."],
]
story += [evidence_table(gui_rows, [70*mm, 104*mm]), Spacer(1, 4*mm)]
story += [callout(
    "Evidence handling",
    "The GUI capture contains no PSK, private key, authentication secret or IPsec key material. It is supporting lab evidence; the production-side proof still requires 1LINK's own active-firewall Untrust capture and ikemgr log.",
    BLUE, LIGHT_BLUE
)]
story += [PageBreak()]

# Page 3 - correlated Palo and server proof
story += [section_label("Evidence 1 - A real Palo Alto reaches Fintap and Fintap answers")]
story += [P("Correlated Palo Alto and StrongSwan proof", "H1X")]
story += [P("The same IKE initiator SPI appears in the PAN-OS system log and in Fintap's packet capture. This correlates the two independent observations even though the lab systems use different clock/timezone settings.", "BodyX")]

palo_rows = [
    ["PAN-OS field", "Live value"],
    ["Event", "ikev2-nego-ike-start"],
    ["Gateway", "FUEL-FINTAP-GW"],
    ["Role", "Initiator, non-rekey"],
    ["Flow", "172.16.1.1:500 -> 178.238.236.126:500"],
    ["Initiator SPI", "fff8c4d0c82ad2f7"],
    ["PAN status after test", "IKE Info: 0 items; Phase 1 not established"],
]
story += [evidence_table(palo_rows, [48*mm, 126*mm]), Spacer(1, 4*mm)]

terminal1 = [
    "2026-09-16T22:03:51+02:00 received packet:",
    "  from 38.104.95.242[10400] to 178.238.236.126[500] (240 bytes)",
    "parsed IKE_SA_INIT request 0 [ SA KE No N(NATD_S_IP) N(NATD_D_IP) ]",
    "38.104.95.242 is initiating an IKE_SA",
    "selected proposal:",
    "  IKE:AES_CBC_256/HMAC_SHA2_256_128/PRF_HMAC_SHA2_256/ECP_256",
    "remote host is behind NAT",
    "generating IKE_SA_INIT response 0 [ SA KE No ... ]",
    "sending packet:",
    "  from 178.238.236.126[500] to 38.104.95.242[10400] (256 bytes)",
    "tcpdump initiator cookie: fff8c4d0c82ad2f7 -> 0000000000000000",
]
story += [TerminalCapture(
    "root@178.238.236.126 - StrongSwan journal + tcpdump",
    terminal1,
    highlight_terms=[
        ("selected proposal", colors.HexColor("#7FE0C3")),
        ("AES_CBC_256", colors.HexColor("#7FE0C3")),
        ("sending packet", colors.HexColor("#7DB9FF")),
        ("fff8c4d0c82ad2f7", colors.HexColor("#FFD166")),
    ]
), Spacer(1, 4*mm)]
story += [callout(
    "What this proves",
    "Fintap accepted the exact 1BILL IKE proposal and generated a valid IKE_SA_INIT response. The PSK and traffic selectors are not used until later exchanges, so this is direct proof of Phase 1 message-1 interoperability.",
    BLUE, LIGHT_BLUE
)]
story += [PageBreak()]

# Page 3 - lab limitation explanation
story += [section_label("Evidence 2 - Why the Fuel lab did not complete the full tunnel")]
story += [P("The return packet was lost after leaving Fintap", "H1X")]
story += [P("CloudShare translated the Palo Alto source to a shared public address and a changing high UDP port. Fintap answered every observed request to the translated source port, but PAN-OS never progressed beyond IKE_SA_INIT and retransmitted the identical initiator SPI.", "BodyX")]

nat_lines = [
    "22:03:51  38.104.95.242:10400 -> 178.238.236.126:500  IKE_SA_INIT request",
    "22:03:51  178.238.236.126:500 -> 38.104.95.242:10400  IKE_SA_INIT response",
    "22:03:56  38.104.95.242:10400 -> 178.238.236.126:500  retransmit",
    "22:03:56  178.238.236.126:500 -> 38.104.95.242:10400  response retransmit",
    "22:04:06  38.104.95.242:10400 -> 178.238.236.126:500  retransmit",
    "22:04:26  38.104.95.242:10400 -> 178.238.236.126:500  new attempt",
    "22:05:06  38.104.95.242:10401 -> 178.238.236.126:500  new NAT mapping",
    "22:06:06  38.104.95.242:10402 -> 178.238.236.126:500  new NAT mapping",
    "CAPTURE TOTAL: 12 packets, 0 dropped by the Fintap kernel",
]
story += [TerminalCapture(
    "tcpdump - public IKE traffic",
    nat_lines,
    highlight_terms=[
        ("-> 178.238.236.126", colors.HexColor("#FFD166")),
        ("178.238.236.126:500 ->", colors.HexColor("#7FE0C3")),
        ("0 dropped", colors.HexColor("#7FE0C3")),
    ]
), Spacer(1, 5*mm)]

flow_rows = [
    ["Stage", "Observed", "Assessment"],
    ["Palo creates IKE_SA_INIT", "Yes", "PAN-OS gateway and proposal are active"],
    ["CloudShare sends it publicly", "Yes", "Request reaches Fintap"],
    ["Fintap accepts proposal", "Yes", "Exact crypto suite selected"],
    ["Fintap sends response", "Yes", "Response visible leaving eth0"],
    ["Palo processes response", "No", "CloudShare/NAT return path is the lab limitation"],
    ["IKE_AUTH / PSK", "Not reached", "Cannot be blamed for this lab stop"],
]
story += [evidence_table(flow_rows, [45*mm, 30*mm, 99*mm]), Spacer(1, 4*mm)]
story += [callout(
    "Important limitation",
    "The Fuel environment proves Palo-to-Fintap message-1 compatibility and Fintap's response. It does not prove the lab's shared Internet NAT can carry a complete site-to-site VPN. This limitation does not weaken the production finding, where no 1LINK request reaches Fintap at all.",
    ORANGE, LIGHT_ORANGE
)]
story += [PageBreak()]

# Page 4 - production proof
story += [section_label("Evidence 3 - Production 1LINK traffic never reaches Fintap")]
story += [P("Production evidence: zero inbound packets from the documented peer", "H1X")]
story += [P("The audit below queried the StrongSwan service journal from 1 September 2026 onward. It counts packets, not configuration entries. Loading a PSK or connection does not increase the inbound count.", "BodyX")]

prod_count = [
    "root@178.238.236.126:~# production-ike-audit",
    "Query window: 2026-09-01 through 2026-09-17",
    "Expected 1LINK public peer: 103.248.140.4",
    "",
    "INBOUND_FROM_1BILL=0",
    "OUTBOUND_TO_1BILL=29",
    "",
    "Control window - Fuel Palo test:",
    "FUEL_INBOUND=9",
    "FUEL_RESPONSES=9",
]
story += [TerminalCapture(
    "StrongSwan production packet-count audit",
    prod_count,
    font_size=8.3,
    highlight_terms=[
        ("INBOUND_FROM_1BILL=0", colors.HexColor("#FF8585")),
        ("OUTBOUND_TO_1BILL=29", colors.HexColor("#FFD166")),
        ("FUEL_INBOUND=9", colors.HexColor("#7FE0C3")),
        ("FUEL_RESPONSES=9", colors.HexColor("#7FE0C3")),
    ]
), Spacer(1, 5*mm)]

prod_lines = [
    "2026-09-14T15:02:10+02:00 initiating IKE_SA onebill[318] to 103.248.140.4",
    "15:02:10 sending 178.238.236.126[500] -> 103.248.140.4[500] (272 bytes)",
    "15:02:14 sending 178.238.236.126[500] -> 103.248.140.4[500] (272 bytes)",
    "15:02:21 sending 178.238.236.126[500] -> 103.248.140.4[500] (272 bytes)",
    "15:02:34 sending 178.238.236.126[500] -> 103.248.140.4[500] (272 bytes)",
    "15:02:57 sending 178.238.236.126[500] -> 103.248.140.4[500] (272 bytes)",
    "No corresponding 'received packet: from 103.248.140.4' record exists.",
]
story += [TerminalCapture(
    "StrongSwan production attempt - 14 Sep 2026",
    prod_lines,
    font_size=7.3,
    highlight_terms=[
        ("sending", colors.HexColor("#FFD166")),
        ("No corresponding", colors.HexColor("#FF8585")),
    ]
), Spacer(1, 4*mm)]
story += [callout(
    "Protocol conclusion",
    "With zero inbound IKE_SA_INIT packets, PSK comparison, IKE identities, proxy IDs, PFS, Phase 2 and HTTPS are not reached. A mismatch in those later parameters cannot produce the observed zero-packet condition.",
    RED, LIGHT_RED
)]
story += [PageBreak()]

# Page 5 - server readiness and independent control
story += [section_label("Evidence 4 - Fintap service readiness and independent control")]
story += [P("The endpoint is listening and an exact-profile control SA is established", "H1X")]

listen_lines = [
    "root@178.238.236.126:~# ss -lunp | grep -E ':(500|4500) '",
    "UNCONN 0 0 0.0.0.0:500   0.0.0.0:* users:((charon-systemd,pid=63160))",
    "UNCONN 0 0 0.0.0.0:4500  0.0.0.0:* users:((charon-systemd,pid=63160))",
    "UNCONN 0 0 [::]:500      [::]:*    users:((charon-systemd,pid=63160))",
    "UNCONN 0 0 [::]:4500     [::]:*    users:((charon-systemd,pid=63160))",
]
story += [TerminalCapture(
    "Fintap IKE listeners",
    listen_lines,
    font_size=7.2,
    highlight_terms=[("charon-systemd", colors.HexColor("#7FE0C3"))]
), Spacer(1, 4*mm)]

sa_lines = [
    "azure-test: #399, ESTABLISHED, IKEv2",
    "  local  178.238.236.126[4500]",
    "  remote 20.187.97.214[4500]",
    "  AES_CBC-256/HMAC_SHA2_256_128/PRF_HMAC_SHA2_256/ECP_256",
    "  azure-test-https: #26, INSTALLED, TUNNEL-in-UDP",
    "  ESP:AES_CBC-256/HMAC_SHA2_256_128/ECP_256",
    "  local  172.31.254.10/32",
    "  remote 10.1.1.4/32",
]
story += [TerminalCapture(
    "Independent exact-crypto control SA",
    sa_lines,
    font_size=7.8,
    highlight_terms=[
        ("ESTABLISHED", colors.HexColor("#7FE0C3")),
        ("INSTALLED", colors.HexColor("#7FE0C3")),
        ("AES_CBC-256", colors.HexColor("#7DB9FF")),
    ]
), Spacer(1, 5*mm)]

profile_rows = [
    ["Parameter", "1BILL documented value", "Fintap / tested value", "Result"],
    ["IKE version", "IKEv2 only", "IKEv2", "Match"],
    ["IKE encryption", "AES-256-CBC", "AES_CBC_256", "Match"],
    ["IKE integrity", "SHA-256", "HMAC_SHA2_256_128", "Match"],
    ["IKE PRF", "PRF 256", "PRF_HMAC_SHA2_256", "Match"],
    ["DH group", "Group 19", "ECP_256 / group 19", "Match"],
    ["IKE lifetime", "28,800 seconds", "28,800 seconds", "Match"],
    ["ESP", "AES-256 / SHA-256", "AES_CBC_256 / SHA2_256", "Match"],
    ["PFS", "Group 19", "ECP_256 / group 19", "Match"],
]
story += [evidence_table(profile_rows, [31*mm, 48*mm, 62*mm, 33*mm]), Spacer(1, 4*mm)]
story += [P("The control tunnel remained established while the temporary Fuel test configuration was removed. This independently confirms that the StrongSwan process, UDP listeners, algorithm implementation, NAT-T handling and kernel IPsec stack are operational.", "BodyX")]
story += [PageBreak()]

# Page 6 - protocol and root cause boundary
story += [section_label("Technical interpretation")]
story += [P("Where the production exchange stops", "H1X")]

timeline_rows = [
    ["Protocol step", "Expected direction", "Production status", "Settings evaluated here"],
    ["1. IKE_SA_INIT request", "1LINK -> Fintap", "NOT OBSERVED", "IKE version, proposal, DH, route/ACL"],
    ["2. IKE_SA_INIT response", "Fintap -> 1LINK", "Cannot occur", "Chosen IKE proposal"],
    ["3. IKE_AUTH", "Both directions", "Not reached", "PSK and IKE identities"],
    ["4. Child SA", "Both directions", "Not reached", "Proxy IDs, ESP, PFS"],
    ["5. Application", "Protected traffic", "Not reached", "TCP 443, SNI, allowlist"],
]
story += [evidence_table(timeline_rows, [43*mm, 42*mm, 35*mm, 54*mm]), Spacer(1, 6*mm)]

story += [P("What can still be wrong", "H2X")]
for item in [
    "1LINK has not initiated even though it owns initiation for this one-ended design.",
    "Passive Mode is enabled on the 1LINK Palo Alto gateway, so it only responds and never initiates.",
    "The customer gateway is missing, disabled, uncommitted, pushed to the wrong template, or configured on the passive HA node.",
    "The active peer IP, local interface, route, public NAT address, whitelist or upstream ACL is incorrect.",
    "UDP 500/4500 is blocked before the request reaches Fintap or before a response returns.",
    "The running gateway uses a different IKE version than the supplied IKEv2 document.",
]:
    story.append(P("- " + item, "BulletX"))

story += [Spacer(1, 3*mm), P("What the evidence rules out as the current blocker", "H2X")]
ruled = evidence_table([
    ["Suspected item", "Why it is not the current blocker"],
    ["PSK", "Used in IKE_AUTH, after the missing initial request/response"],
    ["IKE ID", "Authenticated after IKE_SA_INIT"],
    ["Proxy ID / selectors", "Evaluated for the Child SA, later than Phase 1 message 1"],
    ["Phase 2/PFS", "Evaluated only after an IKE SA exists"],
    ["HTTPS / TCP 443", "Application layer after IPsec is installed"],
    ["Old vs new Palo GUI", "PAN-OS 11.1.4 accepted the exact documented proposal"],
], [45*mm, 129*mm])
story += [ruled, Spacer(1, 5*mm)]
story += [callout(
    "Calibrated conclusion",
    "This evidence does not claim which exact 1LINK appliance or rule is faulty. It proves the fault boundary: no production IKE request from 103.248.140.4 reaches Fintap, while a real Palo Alto request does reach Fintap and is answered.",
    BLUE, LIGHT_BLUE
)]
story += [PageBreak()]

# Page 7 - requested evidence/action
story += [section_label("Required action from 1LINK")]
story += [P("One synchronized test will identify the exact failing device", "H1X")]
story += [P("Agree on an exact timestamp and timezone. Start the Fintap capture first. Then 1LINK must initiate from the active Palo Alto firewall and preserve the following outputs.", "BodyX")]

commands = [
    "show vpn ike-sa gateway <gateway-name>",
    "show vpn ipsec-sa tunnel <tunnel-name>",
    "less mp-log ikemgr.log",
    "test vpn ike-sa gateway <gateway-name>",
    "test vpn ipsec-sa tunnel <tunnel-name>",
]
story += [TerminalCapture(
    "Commands requested from the active 1LINK Palo Alto",
    commands,
    font_size=8.3,
    label="SAFE TO SHARE - DOES NOT REVEAL THE PSK"
), Spacer(1, 5*mm)]

request_rows = [
    ["Evidence 1LINK must provide", "Acceptance condition"],
    ["Untrust packet capture", "Shows 103.248.140.4 -> 178.238.236.126 on UDP 500/4500"],
    ["Return traffic in same capture", "Shows whether Fintap's response arrives back at the Palo"],
    ["System log event", "ikev2-nego-ike-start on the active gateway"],
    ["ikemgr log excerpt", "Includes the exact attempt timestamp and failure reason"],
    ["Running gateway screen", "IKEv2 only; Passive Mode off if 1LINK initiates; correct interface/peer"],
    ["HA and commit status", "Output is from the active firewall and the candidate change is committed"],
    ["Panorama / PAN-OS versions", "Confirms no version-specific interpretation issue"],
]
story += [evidence_table(request_rows, [69*mm, 105*mm]), Spacer(1, 5*mm)]
story += [callout(
    "Meeting statement",
    "Please demonstrate an IKE_SA_INIT packet leaving your active Palo Alto toward 178.238.236.126 and provide the matching Untrust capture. Our server recorded zero inbound packets from 103.248.140.4, while it immediately received and answered every IKE_SA_INIT generated by a real Palo Alto VM.",
    GREEN, LIGHT_GREEN
), Spacer(1, 5*mm)]

story += [P("Evidence handling and cleanup", "H2X")]
for item in [
    "No PSK, private key, API credential, database credential or IPsec key material is included in this pack.",
    "The temporary Fintap Fuel connection and combined-load files were removed after testing.",
    "The original onebill, laptop-test and azure-test connections were restored and verified loaded.",
    "The Fuel lab is ephemeral and its Palo Alto configuration disappears when the lab expires.",
    "Raw log timestamps retain their source timezone. The shared SPI is the correlation key across systems.",
]:
    story.append(P("- " + item, "BulletX"))

story += [Spacer(1, 5*mm)]
story += [P("Prepared from live observations on the Fuel Palo Alto VM-Series firewall and the production Fintap StrongSwan host. This pack is a sanitized technical evidence summary, not a substitute for 1LINK's own active-firewall capture.", "Small")]

doc.build(story)

reader = PdfReader(str(OUT))
assert len(reader.pages) == 8, f"Expected 8 pages, got {len(reader.pages)}"
assert reader.metadata.title == "1BILL VPN Evidence Pack - Fintap Endpoint Validation"
print(OUT)
