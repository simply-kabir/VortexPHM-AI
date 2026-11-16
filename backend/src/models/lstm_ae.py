"""python -m src.models.lstm_ae --dataset ncmapss"""
import argparse, json
import numpy as np, pandas as pd, torch, torch.nn as nn, torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import GroupShuffleSplit
from src.core.config import *
from src.models.evaluation import calibrate_threshold, evaluate_alarms, summarize_alarms

T = 20


class LSTMAE(nn.Module):
    def __init__(self, n_feat, hidden=64, latent=16):
        super().__init__()
        self.enc = nn.LSTM(n_feat, hidden, batch_first=True)
        self.to_lat, self.from_lat = nn.Linear(hidden, latent), nn.Linear(latent, hidden)
        self.dec, self.out = nn.LSTM(hidden, hidden, batch_first=True), nn.Linear(hidden, n_feat)

    def forward(self, x):
        _, (h, _) = self.enc(x)
        d = self.from_lat(self.to_lat(h[-1])).unsqueeze(1).repeat(1, x.size(1), 1)
        return self.out(self.dec(d)[0])


def make_windows(df, cols):
    X, idx = [], []
    for _, g in df.sort_values(["uid", "cycle"]).groupby("uid", sort=False):
        a = g[cols].to_numpy(np.float32)
        pad = np.vstack([np.repeat(a[:1], T - 1, axis=0), a])
        X.append(np.lib.stride_tricks.sliding_window_view(pad, T, axis=0).transpose(0, 2, 1)); idx.append(g.index.to_numpy())
    return np.concatenate(X), np.concatenate(idx)


@torch.no_grad()
def score(model, dev, X, per_feature=False, bs=1024):
    out = []
    for i in range(0, len(X), bs):
        xb = torch.from_numpy(X[i:i + bs]).to(dev)
        err = (model(xb) - xb) ** 2
        out.append((err.mean(dim=1) if per_feature else err.mean(dim=(1, 2))).cpu().numpy())
    return np.concatenate(out)


def main(name):
    df = pd.read_parquet(PROC / f"{name}.parquet").reset_index(drop=True)
    cols = [c for c in df.columns if c.endswith("_c_mean_z")]
    dev_df, test_df = df[df.split == "dev"], df[df.split == "test"]
    tr_i, va_i = next(GroupShuffleSplit(1, test_size=0.25, random_state=SEED).split(dev_df, groups=dev_df.group_unit))
    tr, va = dev_df.iloc[tr_i], dev_df.iloc[va_i]
    Xtr, itr = make_windows(tr, cols)
    nominal = (df.loc[itr, "cycle"] < df.loc[itr, "onset_cycle"]).to_numpy()
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    model = LSTMAE(len(cols)).to(dev)
    opt = torch.optim.Adam(model.parameters(), 1e-3)
    dl = DataLoader(TensorDataset(torch.from_numpy(Xtr[nominal])), batch_size=256, shuffle=True)
    for ep in range(40):
        for (xb,) in dl:
            xb = xb.to(dev); loss = F.mse_loss(model(xb), xb)
            opt.zero_grad(); loss.backward(); opt.step()
    model.eval()
    va_scored, te_scored = va.copy(), test_df.copy()
    for d in (va_scored, te_scored):
        X, idx = make_windows(d, cols)
        d.loc[idx, "ae_score"] = score(model, dev, X)
    thr = calibrate_threshold(va_scored, "ae_score")
    res = dict(lstm_ae=summarize_alarms(evaluate_alarms(te_scored, "ae_score", thr)), threshold=thr, device=dev)
    (RESULTS / f"lstm_ae_{name}.json").write_text(json.dumps(res, indent=2)); print(res)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--dataset", required=True); main(ap.parse_args().dataset)
