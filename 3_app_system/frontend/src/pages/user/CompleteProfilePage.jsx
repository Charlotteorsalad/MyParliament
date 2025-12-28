import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks";
import { useLanguage } from "../../contexts/LanguageContext";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import SuccessModal from "../../components/SuccessModal";
import LoadingModal from "../../components/LoadingModal";

const states = [
  "Perlis",
  "Kedah", 
  "Kelantan",
  "Terengganu",
  "Penang",
  "Perak",
  "Pahang",
  "Selangor",
  "Federal Territory of Kuala Lumpur",
  "Federal Territory of Putrajaya",
  "Negeri Sembilan",
  "Malacca",
  "Johor",
  "Federal Territory of Labuan",
  "Sabah",
  "Sarawak"
];
const constituencies = {
  "Perlis": ["Arau", "Kangar","Padang Besar"],
  "Kedah": ["Langkawi","Jerlun","Kubang Pasu","Padang Terap","Pokok Sena","Alor Setar","Kuala Kedah",
            "Pendang","Jerai","Sik","Merbok","Sungai Petani","Baling","Padang Serai","Kulim-Bandar Baharu"],
  "Kelantan": ["Tumpat","Pengkalan Chepa","Kota Bharu","Pasir Mas","Rantau Panjang","Kubang Kerian","Bachok",
               "Ketereh","Tanah Merah","Pasir Puteh","Machang","Jeli","Kuala Krai","Gua Musang"],
  "Terengganu": ["Besut","Setiu","Kuala Nerus","Kuala Terengganu","Marang","Hulu Terengganu","Dungun","Kemaman"],
  "Penang": ["Kepala Batas","Tasek Gelugor","Bagan","Permatang Pauh","Bukit Mertajam","Batu Kawan",
                   "Nibong Tebal","Bukit Bendera","Tanjong","Jelutong","Bukit Gelugor","Bayan Baru","Balik Pulau"],
  "Perak": ["Gerik","Lenggong","Larut","Parit Buntar","Bagan Serai","Bukit Gantang","Taiping","Padang Rengas",
            "Sungai Siput","Tambun","Ipoh Timor","Ipoh Barat","Batu Gajah","Kuala Kangsar","Beruas","Parit","Kampar",
            "Gopeng","Tapah","Pasir Salak","Lumut","Bagan Datuk","Teluk Intan","Tanjong Malim"],
  "Pahang": ["Cameron Highlands","Lipis","Raub","Jerantut","Indera Mahkota","Kuantan","Paya Besar","Pekan","Maran",
             "Kuala Krau","Temerloh","Bentong","Bera","Rompin"],
  "Selangor": ["Sabak Bernam","Sungai Besar","Hulu Selangor","Tanjong Karang","Kuala Selangor","Selayang","Gombak",
               "Ampang","Pandan","Hulu Langat","Bangi","Puchong","Subang","Petaling Jaya","Damansara","Sungai Buloh",
               "Shah Alam","Kapar","Klang","Kota Raja","Kuala Langat","Sepang"],
  "Kuala Lumpur": ["Kepong","Batu","Wangsa Maju","Segambut","Setiawangsa","Titiwangsa","Bukit Bintang","Lembah Pantai",
                   "Seputeh","Cheras","Bandar Tun Razak"],
  "Federal Territory of Putrajaya": ["Putrajaya"],
  "Negeri Sembilan": ["Jelebu","Jempol","Seremban","Kuala Pilah","Rasah","Rembau","Port Dickson","Tampin"],
  "Melaka": ["Masjid Tanah","Alor Gajah","Tangga Batu","Hang Tuah Jaya","Kota Melaka","Jasin"],
  "Johor": ["Segamat","Sekijang","Labis","Pagoh","Ledang","Bakri","Muar"],
  "Federal Territory of Labuan": ["Labuan"],
  "Sabah": ["Kudat","Kota Marudu","Kota Belud","Tuaran","Sepanggar","Kota Kinabalu","Putatan","Penampang",
            "Papar","Kimanis","Beaufort","Sipitang","Ranau","Keningau","Tenom","Pensiangan","Beluran","Libaran",
            "Batu Sapi","Sandakan","Kinabatangan","Lahad Datu","Semporna","Tawau","Kalabakan"],
  "Sarawak": ["Mas Gading","Santubong","Petra Jaya","Bandar Kuching","Stampin","Kota Samarahan","Puncak Borneo",
              "Serian","Batang Sadong","Batang Lupar","Sri Aman","Lubok Antu","Betong","Saratok","Tanjong Manis","Igan",
              "Sarikei","Julau","Kanowit","Lanang","Sibu","Mukah","Selangau","Kapit","Hulu Rajang","Bintulu","Sibuti","Miri",
              "Baram","Limbang","Lawas"]
};

function CompleteProfilePage() {
  const navigate = useNavigate();
  const { completeProfile, loading, error, clearError, user, updateProfileStatus } = useAuth();
  const { t } = useLanguage();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    BOD: null,
    state: "",
    constituency: "",
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showLoadingModal, setShowLoadingModal] = useState(false);

  // Save profile data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('registrationStep2Data', JSON.stringify(form));
  }, [form]);

  // Load saved profile data from localStorage
  useEffect(() => {
    const savedProfileData = localStorage.getItem('registrationStep2Data');
    if (savedProfileData) {
      try {
        const parsedData = JSON.parse(savedProfileData);
        setForm(prev => ({ ...prev, ...parsedData }));
      } catch (error) {
        console.error('Error parsing saved profile data:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Check if user has a temp token (from step 1 registration) OR is already authenticated
    const tempToken = localStorage.getItem('tempToken');
    const regularToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    if (!tempToken && !regularToken) {
      // Redirect to registration if no token at all
      navigate('/register');
      return;
    }

    // Check if user already completed profile
    if (user?.registrationStatus === 'completed') {
      navigate('/profile');
      return;
    }
  }, [user, navigate]);

  const validateForm = () => {
    const errors = {};
    
    if (!form.firstName.trim()) {
      errors.firstName = t('firstNameRequired');
    }
    
    if (!form.lastName.trim()) {
      errors.lastName = t('lastNameRequired');
    }
    
    if (!form.BOD) {
      errors.BOD = t('birthDateRequired');
    }
    
    if (!form.state) {
      errors.state = t('stateRequired');
    }
    
    if (!form.constituency) {
      errors.constituency = t('constituencyRequired');
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    // Clear validation error when user starts typing
    if (validationErrors[e.target.name]) {
      setValidationErrors(prev => ({ ...prev, [e.target.name]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    
    if (!validateForm()) {
      return;
    }

    // Show loading modal immediately
    setShowLoadingModal(true);
    
    try {
      await completeProfile(form);
      // Clear saved registration data
      localStorage.removeItem('registrationStep1Data');
      localStorage.removeItem('registrationStep2Data');
      
      // Force 3 second delay with loading modal
      console.log('Profile completed, starting 3-second delay...');
      setTimeout(() => {
        console.log('3 seconds elapsed, showing success modal');
        setShowLoadingModal(false);
        setShowSuccessModal(true);
      }, 5000);
      
    } catch (err) {
      console.error("Failed to complete profile:", err);
      // Hide loading modal on error
      setShowLoadingModal(false);
      // Error is already handled by the useAuth hook
    }
  };

  const handleSuccessModalClose = () => {
    console.log('Success modal close triggered');
    setShowSuccessModal(false);
    
    // Update the user's profile status to completed
    updateProfileStatus('completed');
    
    // Navigate to root path
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header (same style as Register) */}
      <div className="w-full bg-white shadow-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#C3C3E5] to-[#A8A8D8] flex items-center justify-center mr-3">
              <svg className="w-6 h-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-800">My Parliament</span>
          </div>
          <Link to="/" className="text-sm font-medium text-gray-700 hover:text-gray-900">{t('back')}</Link>
        </div>
      </div>

      {/* Decorative blurred background layer */}
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#C3C3E5] via-[#e9e9f8] to-white" />
          <div className="absolute inset-0 bg-[url('/images/placeholders/hero.jpg')] bg-cover bg-center opacity-30" />
          <div className="absolute inset-0 backdrop-blur-sm" />
        </div>

        {/* Main content container */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[620px]">
              {/* Left: Info panel */}
              <div className="relative hidden lg:block lg:order-1">
                <div className="absolute inset-0 bg-black/30"></div>
                <div className="relative h-full flex items-center justify-center p-8">
                  <div className="text-center text-white max-w-sm">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <span className="text-4xl">👤</span>
                    </div>
                    <h3 className="text-2xl font-semibold mb-2">{t('completeYourProfile')}</h3>
                    <p className="text-white/85 mb-6">{t('step2Of2')}</p>
                    <div className="bg-white/10 rounded-lg p-4">
                      <p className="text-sm text-white/90">{t('almostThere')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Profile form */}
              <div className="relative bg-white/90 backdrop-blur p-8 flex items-center lg:order-2">
                <div className="w-full max-w-md mx-auto">
                  {/* Back button positioned at top left of the card */}
                  <div className="absolute top-4 left-4">
                    <button
                      onClick={() => navigate('/register')}
                      className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                      </svg>
{t('backToStep1')}
                    </button>
                  </div>

                  <div className="text-center">
                    <h2 className="text-3xl font-extrabold text-gray-900 mb-1">{t('completeProfile')}</h2>
                    <p className="text-gray-600 mb-6">{t('step2Of2TellUsMore')}</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>{t('step1AccountDetails')}</span>
                      <span>{t('step2ProfileInformation')}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-gradient-to-r from-[#C3C3E5] to-[#A8A8D8] h-2 rounded-full transition-all duration-300" style={{ width: '100%' }}></div>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('firstName')} *</label>
                        <input
                          name="firstName"
                          value={form.firstName}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent ${
                            validationErrors.firstName ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder={t('enterYourFirstName')}
                          disabled={loading}
                        />
                        <div className="h-6 mt-1">
                          {validationErrors.firstName && (
                            <p className="text-sm text-red-600">{validationErrors.firstName}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('lastName')} *</label>
                        <input
                          name="lastName"
                          value={form.lastName}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent ${
                            validationErrors.lastName ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder={t('enterYourLastName')}
                          disabled={loading}
                        />
                        <div className="h-6 mt-1">
                          {validationErrors.lastName && (
                            <p className="text-sm text-red-600">{validationErrors.lastName}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('birthDate')} *</label>
                        <DatePicker
                          selected={form.BOD}
                          onChange={(date) => setForm((prev) => ({ ...prev, BOD: date }))}
                          dateFormat="dd/MM/yyyy"
                          placeholderText="DD/MM/YYYY"
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent ${
                            validationErrors.BOD ? 'border-red-500' : 'border-gray-300'
                          }`}
                          disabled={loading}
                        />
                        <div className="h-6 mt-1">
                          {validationErrors.BOD && (
                            <p className="text-sm text-red-600">{validationErrors.BOD}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('state')} *</label>
                        <select
                          name="state"
                          value={form.state}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent ${
                            validationErrors.state ? 'border-red-500' : 'border-gray-300'
                          }`}
                          disabled={loading}
                        >
                          <option value="">{t('selectState')}</option>
                          {states.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <div className="h-6 mt-1">
                          {validationErrors.state && (
                            <p className="text-sm text-red-600">{validationErrors.state}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('federalConstituency')} *</label>
                      <select
                        name="constituency"
                        value={form.constituency}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent ${
                          validationErrors.constituency ? 'border-red-500' : 'border-gray-300'
                        }`}
                        disabled={loading || !form.state}
                      >
                        <option value="">{t('selectConstituency')}</option>
                        {(constituencies[form.state] || []).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <div className="h-6 mt-1">
                        {validationErrors.constituency && (
                          <p className="text-sm text-red-600">{validationErrors.constituency}</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-[#C3C3E5] to-[#A8A8D8] text-white py-3 rounded-lg font-medium hover:from-[#B8B8E0] hover:to-[#9D9DD3] focus:ring-2 focus:ring-[#C3C3E5] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        disabled={loading}
                      >
{loading ? t('completingProfile') : t('completeProfileAndContinue')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Modal */}
      <LoadingModal
        isOpen={showLoadingModal}
        message={t('settingUpYourParliamentaryProfile')}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        title={t('profileCompleted')}
        message={t('welcomeToMyParliament')}
        buttonText={t('continueToDashboard')}
      />
    </div>
  );
}

export default CompleteProfilePage;
