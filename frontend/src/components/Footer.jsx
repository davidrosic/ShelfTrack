import { FacebookIcon, YouTubeIcon, TwitterIcon, LinkedInIcon } from './Icons'

const socialLinks = [
  { label: 'Facebook', Icon: FacebookIcon },
  { label: 'YouTube', Icon: YouTubeIcon },
  { label: 'Twitter', Icon: TwitterIcon },
  { label: 'LinkedIn', Icon: LinkedInIcon },
]

const Footer = () => {
  return (
    <footer style={{ backgroundColor: '#1C1C1C' }}>
      <div className="px-6 lg:px-12 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <span className="text-lg font-bold text-white">
              shelf<span style={{ color: '#D4A574' }}>Track</span>
            </span>
          </div>

          {/* Our Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Our Company</h4>
            <ul className="space-y-2">
              {[
                'About us',
                'Careers',
                'Terms',
                'Privacy',
                'Interest Based Ads',
                'Ad Preferences',
                'Help',
              ].map(item => (
                <li key={item}>
                  <button className="text-xs text-gray-400 hover:text-white transition-colors">
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Work with us */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Work with us</h4>
            <ul className="space-y-2">
              {['Authors', 'Advertise', 'Authors & publishing', 'API'].map(item => (
                <li key={item}>
                  <button className="text-xs text-gray-400 hover:text-white transition-colors">
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Subscribe to our Newsletter</h4>
            <div className="flex">
              <input
                type="email"
                placeholder="Email"
                className="flex-1 px-3 py-2 text-xs bg-transparent border border-gray-700 rounded-l-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-600"
              />
              <button
                className="px-4 py-2 rounded-r-lg text-white text-xs font-semibold transition-all hover:brightness-110"
                style={{ backgroundColor: '#8B7355' }}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contact & Social */}
      <div className="border-t border-gray-800 px-6 lg:px-12 py-8 text-center">
        <h3
          className="text-xl font-bold text-white mb-6"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          CONTACT US
        </h3>
        <div className="flex justify-center gap-4">
          {socialLinks.map(({ label, Icon }) => (
            <div
              key={label}
              className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition-colors cursor-pointer"
            >
              <Icon />
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}

export default Footer
