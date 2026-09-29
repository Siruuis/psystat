import base64
import io

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

BLUE = "#2c6bed"
GREY = "#8894a6"

plt.rcParams.update({
    "figure.dpi": 110,
    "font.size": 9,
    "axes.edgecolor": "#c9d1db",
    "axes.grid": True,
    "grid.color": "#eceff3",
})


def figure_to_png(fig) -> str:
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return "data:image/png;base64," + base64.b64encode(buf.read()).decode("ascii")


def new_axes(width=5.2, height=3.4):
    fig, ax = plt.subplots(figsize=(width, height))
    return fig, ax
