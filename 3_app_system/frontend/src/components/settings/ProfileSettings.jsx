import React from 'react';
import PropTypes from 'prop-types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Input, Button, DatePickerField } from '../ui';

const states = [
  "Perlis", "Kedah", "Kelantan", "Terengganu", "Penang", "Perak", "Pahang", "Selangor",
  "Federal Territory of Kuala Lumpur", "Federal Territory of Putrajaya", "Negeri Sembilan",
  "Malacca", "Johor", "Federal Territory of Labuan", "Sabah", "Sarawak"
];

const constituencies = {
  "Perlis": ["Arau", "Kangar", "Padang Besar"],
  "Kedah": ["Langkawi", "Jerlun", "Kubang Pasu", "Padang Terap", "Pokok Sena", "Alor Setar", "Kuala Kedah",
            "Pendang", "Jerai", "Sik", "Merbok", "Sungai Petani", "Baling", "Padang Serai", "Kulim-Bandar Baharu"],
  "Kelantan": ["Tumpat", "Pengkalan Chepa", "Kota Bharu", "Pasir Mas", "Rantau Panjang", "Kubang Kerian", "Bachok",
               "Ketereh", "Tanah Merah", "Pasir Puteh", "Machang", "Jeli", "Kuala Krai", "Gua Musang"],
  "Terengganu": ["Besut", "Setiu", "Kuala Nerus", "Kuala Terengganu", "Marang", "Hulu Terengganu", "Dungun", "Kemaman"],
  "Penang": ["Kepala Batas", "Tasek Gelugor", "Bagan", "Permatang Pauh", "Bukit Mertajam", "Batu Kawan",
                   "Nibong Tebal", "Bukit Bendera", "Tanjong", "Jelutong", "Bukit Gelugor", "Bayan Baru", "Balik Pulau"],
  "Perak": ["Gerik", "Lenggong", "Larut", "Parit Buntar", "Bagan Serai", "Bukit Gantang", "Taiping", "Padang Rengas",
            "Sungai Siput", "Tambun", "Ipoh Timor", "Ipoh Barat", "Batu Gajah", "Kuala Kangsar", "Beruas", "Parit", "Kampar",
            "Gopeng", "Tapah", "Pasir Salak", "Lumut", "Bagan Datuk", "Teluk Intan", "Tanjong Malim"],
  "Pahang": ["Cameron Highlands", "Lipis", "Raub", "Jerantut", "Indera Mahkota", "Kuantan", "Paya Besar", "Pekan", "Maran",
             "Kuala Krau", "Temerloh", "Bentong", "Bera", "Rompin"],
  "Selangor": ["Sabak Bernam", "Sungai Besar", "Hulu Selangor", "Tanjong Karang", "Kuala Selangor", "Selayang", "Gombak",
               "Ampang", "Pandan", "Hulu Langat", "Bangi", "Puchong", "Subang", "Petaling Jaya", "Damansara", "Sungai Buloh",
               "Shah Alam", "Kapar", "Klang", "Kota Raja", "Kuala Langat", "Sepang"],
  "Kuala Lumpur": ["Kepong", "Batu", "Wangsa Maju", "Segambut", "Setiawangsa", "Titiwangsa", "Bukit Bintang", "Lembah Pantai",
                   "Seputeh", "Cheras", "Bandar Tun Razak"],
  "Federal Territory of Putrajaya": ["Putrajaya"],
  "Negeri Sembilan": ["Jelebu", "Jempol", "Seremban", "Kuala Pilah", "Rasah", "Rembau", "Port Dickson", "Tampin"],
  "Melacca": ["Masjid Tanah", "Alor Gajah", "Tangga Batu", "Hang Tuah Jaya", "Kota Melaka", "Jasin"],
  "Johor": ["Segamat", "Sekijang", "Labis", "Pagoh", "Ledang", "Bakri", "Muar"],
  "Federal Territory of Labuan": ["Labuan"],
  "Sabah": ["Kudat", "Kota Marudu", "Kota Belud", "Tuaran", "Sepanggar", "Kota Kinabalu", "Putatan", "Penampang",
            "Papar", "Kimanis", "Beaufort", "Sipitang", "Ranau", "Keningau", "Tenom", "Pensiangan", "Beluran", "Libaran",
            "Batu Sapi", "Sandakan", "Kinabatangan", "Lahad Datu", "Semporna", "Tawau", "Kalabakan"],
  "Sarawak": ["Mas Gading", "Santubong", "Petra Jaya", "Bandar Kuching", "Stampin", "Kota Samarahan", "Puncak Borneo",
              "Serian", "Batang Sadong", "Batang Lupar", "Sri Aman", "Lubok Antu", "Betong", "Saratok", "Tanjong Manis", "Igan",
              "Sarikei", "Julau", "Kanowit", "Lanang", "Sibu", "Mukah", "Selangau", "Kapit", "Hulu Rajang", "Bintulu", "Sibuti", "Miri",
              "Baram", "Limbang", "Lawas"]
};

const ProfileSettings = ({ 
  profileData, 
  onProfileChange, 
  onSave, 
  loading, 
  profileDataLoading = false,
  hasChanges, 
  validationErrors,
  shakeForm = false
}) => {
  const { t } = useLanguage();
  const formDisabled = loading || profileDataLoading;
  
  return (
    <div className={`space-y-6 ${shakeForm ? 'form-shake' : ''}`}>
      <h3 className="text-xl font-semibold text-gray-900">{t('personalInformation')}</h3>
      {profileDataLoading && (
        <p className="text-sm text-gray-500">{t('loading')}...</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={t('firstName')}
          value={profileData.firstName}
          onChange={(e) => onProfileChange('firstName', e.target.value)}
          error={validationErrors.firstName}
          required
          disabled={formDisabled}
        />

        <Input
          label={t('lastName')}
          value={profileData.lastName}
          onChange={(e) => onProfileChange('lastName', e.target.value)}
          error={validationErrors.lastName}
          required
          disabled={formDisabled}
        />

        <DatePickerField
          label={t('birthDate')}
          value={profileData.BOD}
          onChange={(date) => onProfileChange('BOD', date)}
          placeholder={t('enterBirthDate')}
          error={validationErrors.BOD}
          disabled={formDisabled}
          required
          minDate={new Date(1900, 0, 1)}
          maxDate={new Date()}
        />

        <Input.Select
          label={t('state')}
          value={profileData.state}
          onChange={(e) => onProfileChange('state', e.target.value)}
          error={validationErrors.state}
          required
          disabled={formDisabled}
          options={states.map(state => ({ value: state, label: state }))}
        />
      </div>

      <Input.Select
        label={t('federalConstituency')}
        value={profileData.constituency}
        onChange={(e) => onProfileChange('constituency', e.target.value)}
        error={validationErrors.constituency}
        required
        disabled={formDisabled || !profileData.state}
        options={[
          { value: '', label: ' ' },
          ...(constituencies[profileData.state] || []).map(constituency => ({ 
            value: constituency, 
            label: constituency 
          }))
        ]}
      />

      <Button
        onClick={onSave}
        disabled={loading || !hasChanges}
        variant="gradient"
        loading={loading}
      >
        {loading ? t('saving') : t('updateProfile')}
      </Button>
    </div>
  );
};

ProfileSettings.propTypes = {
  profileData: PropTypes.object.isRequired,
  onProfileChange: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  profileDataLoading: PropTypes.bool,
  hasChanges: PropTypes.bool.isRequired,
  validationErrors: PropTypes.object.isRequired,
  shakeForm: PropTypes.bool
};

export default ProfileSettings;

