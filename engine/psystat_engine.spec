# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

datas = []
hiddenimports = []

# Big scientific libs (numpy, scipy, pandas, sklearn, matplotlib) are handled by
# PyInstaller's built-in / contrib hooks via the import graph. We only help with
# libraries that do lazy imports or ship data files.
for pkg in ["statsmodels", "pingouin", "uvicorn"]:
    hiddenimports += collect_submodules(pkg)

for pkg in ["statsmodels", "pingouin", "patsy"]:
    datas += collect_data_files(pkg)

hiddenimports += [
    "pandas_flavor", "tabulate", "sklearn.utils._typedefs", "sklearn.neighbors._partition_nodes",
    "scipy.special.cython_special", "scipy._lib.array_api_compat.numpy.fft",
    "analyses", "transform", "dataset", "charts",
]

a = Analysis(
    ["main.py"],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        "tkinter", "PyQt5", "PyQt6", "PySide2", "PySide6", "IPython", "jupyter",
        "notebook", "pytest", "sphinx", "nbconvert", "numpy.tests", "pandas.tests",
        "scipy.tests", "sklearn.tests", "matplotlib.tests", "statsmodels.tests",
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="psystat-engine",
    console=True,
    disable_windowed_traceback=False,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="psystat-engine",
)
