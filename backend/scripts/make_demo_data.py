"""Creates SMALL SYNTHETIC files in the NASA N-CMAPSS (.h5) and C-MAPSS (.txt) formats so you can run the whole
pipeline, API and UI before downloading the real data.

Usage (from backend/):  python -m scripts.make_demo_data

Everything produced from this data is meaningless for science: it only proves the plumbing works.
Delete data/raw/*/ before using the real NASA files."""
import numpy as np, h5py, pathlib
from src.core.config import RAW
rng = np.random.default_rng(0)
RAW = pathlib.Path(RAW)
(RAW / "ncmapss").mkdir(parents=True, exist_ok=True)
(RAW / "cmapss").mkdir(parents=True, exist_ok=True)
W_VAR = ["alt","Mach","TRA","T2"]
XS_VAR = ["Wf","Nf","Nc","T24","T30","T48","T50","P15","P2","P21","P24","Ps30","P40","P50"]
T_VAR = ["fan_eff_mod","fan_flow_mod","LPC_eff_mod","LPC_flow_mod","HPC_eff_mod","HPC_flow_mod","HPT_eff_mod","HPT_flow_mod","LPT_eff_mod","LPT_flow_mod"]
A_VAR = ["unit","cycle","Fc","hs"]
FC = {1:(3000,0.30,60,505), 2:(25000,0.62,75,470), 3:(35000,0.78,85,455)}
def make_unit(unit, fault, life, secs=200):
    rW,rX,rT,rA,rY = [],[],[],[],[]
    fc = int(rng.integers(1,4)); onset = int(life*rng.uniform(0.35,0.5))
    for cyc in range(1, life+1):
        deg = 0.0 if cyc<onset else (cyc-onset)/(life-onset); hs = 1 if cyc<onset else 0
        alt,mach,tra,t2 = FC[fc]
        W = np.column_stack([alt+rng.normal(0,50,secs), mach+rng.normal(0,0.005,secs), tra+rng.normal(0,0.5,secs), t2+rng.normal(0,0.4,secs)])
        T2 = W[:,3]; P2 = 14.7*np.exp(-alt/45000)+rng.normal(0,0.02,secs); th, de = T2/518.67, P2/14.696
        T24 = T2*1.28+rng.normal(0,0.6,secs); P24 = P2*1.9+rng.normal(0,0.04,secs)
        T30 = T24*2.4; P30 = P24*14+rng.normal(0,0.3,secs); Ps30 = P30*0.085
        T48 = T30*1.15; T50 = T30*0.89; P15 = P2*1.5; P21 = P2*1.45; P40 = P30*0.55; P50 = P2*1.1
        Nf = 2300*np.sqrt(th)+rng.normal(0,4,secs); Nc = 8900*np.sqrt(th)+rng.normal(0,10,secs); Wf = 1.8*de*np.sqrt(th)+rng.normal(0,0.01,secs)
        h = np.zeros(10)
        if fault=="HPC": T30*=1+0.05*deg; Ps30*=1-0.04*deg; Nc*=1-0.012*deg; h[4]=h[5]=-0.04*deg
        elif fault=="HPT": T48*=1+0.06*deg; T50*=1+0.05*deg; P40*=1-0.03*deg; h[6]=h[7]=-0.04*deg
        elif fault=="FAN": Nf*=1-0.02*deg; P21*=1-0.03*deg; T24*=1+0.025*deg; h[0]=h[1]=-0.04*deg
        X = np.column_stack([Wf,Nf,Nc,T24,T30,T48,T50,P15,P2,P21,P24,Ps30,P40,P50]) + rng.normal(0,1,(secs,14))*np.array([0.002,1,2,0.5,1,1,1,.01,.005,.01,.02,.05,.1,.01])
        rW.append(W); rX.append(X); rT.append(np.tile(h,(secs,1)))
        rA.append(np.column_stack([np.full(secs,unit),np.full(secs,cyc),np.full(secs,fc),np.full(secs,hs)])); rY.append(np.full(secs, life-cyc))
    return [np.vstack(r) for r in (rW,rX,rT,rA)] + [np.concatenate(rY)[:,None]]
def write(path, dev_units, test_units):
    parts = {}
    for split, units in (("dev",dev_units),("test",test_units)):
        out = [make_unit(u,f,l) for u,f,l in units]
        for name, idx in (("W",0),("X_s",1),("T",2),("A",3),("Y",4)): parts[f"{name}_{split}"] = np.vstack([o[idx] for o in out])
    with h5py.File(path,"w") as f:
        for k,v in parts.items(): f.create_dataset(k, data=v.astype("float64"))
        for name,var in (("W",W_VAR),("X_s",XS_VAR),("T",T_VAR),("A",A_VAR)): f.create_dataset(f"{name}_var", data=np.array(var, dtype="S"))
dev = [(1,"HPC",70),(2,"HPC",75),(3,"HPC",68),(4,"HPT",72),(5,"HPT",66),(6,"HPT",74),(7,"FAN",71),(8,"FAN",69),(9,"FAN",73)]
test = [(10,"HPC",70),(11,"HPT",72),(12,"FAN",68)]
write(RAW/"ncmapss"/"N-CMAPSS_DS99-demo.h5", dev, test)
cols = ["unit","cycle","op1","op2","op3"]+[f"s{i}" for i in range(1,22)]
def cm(units, trunc=False):
    rows=[]; rul_end=[]
    for u in range(1,units+1):
        life=int(rng.integers(150,260)); cut = life if not trunc else int(life*rng.uniform(0.5,0.9))
        for c in range(1,cut+1):
            d = max(0, c-(life-110))/110.0
            s = np.array([518.67, 642+2*d+rng.normal(0,.3), 1589+25*d+rng.normal(0,2), 1400+18*d+rng.normal(0,2), 14.62, 21.6, 554-6*d+rng.normal(0,.3), 2388, 9046-20*d+rng.normal(0,3), 1.3, 47.5-1.5*d+rng.normal(0,.1), 521, 2388, 8138, 8.4, .03, 392, 2388, 100, 39, 23.4])
            rows.append([u,c,0,0,100]+list(s))
        rul_end.append(life-cut)
    return np.array(rows), rul_end
tr,_ = cm(20); te,re = cm(8, True)
np.savetxt(RAW/"cmapss"/"train_FD001.txt", tr, fmt="%.4f"); np.savetxt(RAW/"cmapss"/"test_FD001.txt", te, fmt="%.4f"); np.savetxt(RAW/"cmapss"/"RUL_FD001.txt", np.array(re), fmt="%d")
print("Demo data written to", RAW)
