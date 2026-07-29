import { CheckIcon, DocumentIcon, ToolIcon } from "./Icons";

const tasks = [
  ["Rens tagrender", "13. juni 2026", "Næste 30 dage"],
  ["Service varmepumpe", "14. maj 2026", "Aktiv"],
];

export function PhoneMockup() {
  return (
    <div className="phone" aria-label="Eksempel på Matriva appen">
      <div className="phone__screen">
        <div className="phone__status">
          <span>9:41</span>
          <span className="phone__island" />
          <span>● ●</span>
        </div>

        <div className="phone__body">
          <p className="phone__top-label">Matriva</p>
          <p className="phone__hello">Overblik</p>
          <p className="phone__subtitle">Det vigtigste om dit hus lige nu.</p>
          <p className="phone__address">Ringstedgade 130</p>

          <div className="house-card">
            <div className="house-card__mark">M</div>
            <div>
              <p className="house-card__label">Dit gemte hus</p>
              <p className="house-card__title">Ringstedgade 130</p>
              <p className="house-card__meta">Gemt hus · Registreret i BBR</p>
            </div>
          </div>

          <div className="maintenance-card">
            <div>
              <p className="maintenance-card__title">Vedligehold</p>
              <p className="maintenance-card__copy">2 aktive opgaver.</p>
            </div>
            <div className="maintenance-card__stats">
              <span>
                <strong>2</strong>
                Aktive
              </span>
              <span>
                <strong>0</strong>
                Overskredet
              </span>
            </div>
          </div>

          <p className="phone__section-title">Næste opgaver</p>

          {tasks.map(([title, date, due], index) => (
            <div className="phone-task" key={title}>
              <div className="phone-task__icon">
                {index === 0 ? (
                  <ToolIcon width="14" />
                ) : (
                  <CheckIcon width="14" />
                )}
              </div>
              <div>
                <p className="phone-task__title">{title}</p>
                <p className="phone-task__meta">{date}</p>
              </div>
              <span className="phone-task__due">{due}</span>
            </div>
          ))}

          <div className="document-row">
            <div className="phone-task__icon">
              <DocumentIcon width="14" />
            </div>
            <div>
              <p className="phone-task__title">Dokumentarkiv</p>
              <p className="phone-task__meta">Boligpapirer og kvitteringer</p>
            </div>
          </div>

          <div className="phone__nav">
            <span>Dashboard</span>
            <span>Mit hus</span>
            <span>Vedligehold</span>
            <span>Dokumenter</span>
            <span>Mere</span>
          </div>
        </div>
      </div>
    </div>
  );
}
