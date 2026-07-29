import { BellIcon, CheckIcon, ToolIcon } from "./Icons";

const tasks = [
  ["Service varmepumpe", "14. maj 2026", "Om 12 dage"],
  ["Rens tagrender", "13. juni 2026", "Om 32 dage"],
  ["Udskift filter", "9. juli 2026", "Om 59 dage"],
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
          <p className="phone__top-label">Overblik</p>
          <p className="phone__hello">Hej René</p>
          <p className="phone__address">Ringstedgade 130</p>

          <div className="health-card">
            <div className="health-card__score">82</div>
            <div>
              <p className="health-card__title">Boligens sundhed</p>
              <p className="health-card__copy">Godt gået · 12 opgaver i gang</p>
            </div>
          </div>

          <p className="phone__section-title">Næste opgaver</p>

          {tasks.map(([title, date, due], index) => (
            <div className="phone-task" key={title}>
              <div className="phone-task__icon">
                {index === 0 ? (
                  <ToolIcon width="14" />
                ) : index === 1 ? (
                  <CheckIcon width="14" />
                ) : (
                  <BellIcon width="14" />
                )}
              </div>
              <div>
                <p className="phone-task__title">{title}</p>
                <p className="phone-task__meta">{date}</p>
              </div>
              <span className="phone-task__due">{due}</span>
            </div>
          ))}

          <div className="phone__nav">
            <span>Overblik</span>
            <span>Opgaver</span>
            <span>Dokumenter</span>
            <span>Mere</span>
          </div>
        </div>
      </div>
    </div>
  );
}
