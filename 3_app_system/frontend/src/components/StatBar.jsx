import { useLanguage } from '../contexts/LanguageContext';

export default function StatBar({ stats }) {
    const { t } = useLanguage();
    
    return (
      <div className="kpis">
        <div className="kpi"><div className="kpi-label">{t('totalMPs')}</div><div className="kpi-value">{stats?.kpis?.totalMPs ?? '-'}</div></div>
        <div className="kpi"><div className="kpi-label">{t('activeMPs')}</div><div className="kpi-value">{stats?.kpis?.activeMPs ?? '-'}</div></div>
        <div className="kpi"><div className="kpi-label">{t('politicalParties')}</div><div className="kpi-value">{stats?.kpis?.distinctParties ?? '-'}</div></div>
        <div className="kpi"><div className="kpi-label">{t('state')}</div><div className="kpi-value">{stats?.kpis?.distinctStates ?? '-'}</div></div>
      </div>
    );
  }  