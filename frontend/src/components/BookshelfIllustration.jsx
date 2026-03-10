const BookshelfIllustration = () => (
  <svg viewBox="0 0 400 350" className="w-full max-w-md" xmlns="http://www.w3.org/2000/svg">
    {/* Shelf frame */}
    <rect x="60" y="30" width="280" height="280" rx="8" fill="#3D2B1F" stroke="#5C3D2E" strokeWidth="3"/>
    
    {/* Shelf dividers */}
    <rect x="60" y="120" width="280" height="6" fill="#5C3D2E"/>
    <rect x="60" y="210" width="280" height="6" fill="#5C3D2E"/>
    
    {/* Top shelf books */}
    <rect x="80" y="45" width="22" height="72" rx="2" fill="#1a1a1a"/>
    <rect x="106" y="50" width="18" height="67" rx="2" fill="#C4956A"/>
    <rect x="128" y="42" width="25" height="75" rx="2" fill="#E8D5B7"/>
    <rect x="157" y="55" width="16" height="62" rx="2" fill="#2C2C2C"/>
    <rect x="177" y="48" width="20" height="69" rx="2" fill="#8B6F4E"/>
    <rect x="201" y="40" width="28" height="77" rx="2" fill="#D4A574"/>
    <rect x="233" y="52" width="18" height="65" rx="2" fill="#1a1a1a"/>
    <rect x="255" y="44" width="22" height="73" rx="2" fill="#C4956A"/>
    <rect x="281" y="50" width="20" height="67" rx="2" fill="#3D2B1F"/>
    <rect x="305" y="46" width="18" height="71" rx="2" fill="#E8D5B7"/>
    
    {/* Middle shelf books */}
    <rect x="85" y="135" width="24" height="70" rx="2" fill="#D4A574"/>
    <rect x="113" y="140" width="18" height="65" rx="2" fill="#1a1a1a"/>
    <rect x="135" y="132" width="22" height="73" rx="2" fill="#C4956A"/>
    <rect x="162" y="145" width="16" height="60" rx="2" fill="#E8D5B7"/>
    <rect x="182" y="138" width="26" height="67" rx="2" fill="#8B6F4E"/>
    <rect x="212" y="142" width="18" height="63" rx="2" fill="#2C2C2C"/>
    <rect x="234" y="130" width="20" height="75" rx="2" fill="#D4A574"/>
    <rect x="258" y="140" width="24" height="65" rx="2" fill="#1a1a1a"/>
    <rect x="286" y="136" width="18" height="69" rx="2" fill="#C4956A"/>

    {/* Bottom shelf books */}
    <rect x="80" y="225" width="20" height="72" rx="2" fill="#8B6F4E"/>
    <rect x="104" y="230" width="26" height="67" rx="2" fill="#E8D5B7"/>
    <rect x="134" y="222" width="18" height="75" rx="2" fill="#1a1a1a"/>
    <rect x="156" y="235" width="22" height="62" rx="2" fill="#D4A574"/>
    <rect x="182" y="228" width="16" height="69" rx="2" fill="#C4956A"/>
    <rect x="202" y="232" width="24" height="65" rx="2" fill="#2C2C2C"/>
    <rect x="230" y="225" width="20" height="72" rx="2" fill="#8B6F4E"/>
    <rect x="254" y="238" width="18" height="59" rx="2" fill="#E8D5B7"/>
    <rect x="276" y="228" width="22" height="69" rx="2" fill="#D4A574"/>

    {/* Plant pot */}
    <rect x="310" y="280" width="30" height="25" rx="3" fill="#2C2C2C"/>
    <ellipse cx="325" cy="278" rx="16" ry="4" fill="#2C2C2C"/>
    {/* Plant leaves */}
    <path d="M325 278 Q320 255 305 245" stroke="#3D5C3A" strokeWidth="2" fill="none"/>
    <path d="M325 278 Q330 250 340 240" stroke="#3D5C3A" strokeWidth="2" fill="none"/>
    <path d="M325 278 Q318 260 310 255" stroke="#4A7A47" strokeWidth="2" fill="none"/>
    <path d="M325 278 Q335 258 342 252" stroke="#4A7A47" strokeWidth="2" fill="none"/>
    <ellipse cx="305" cy="244" rx="8" ry="5" fill="#3D5C3A" transform="rotate(-30 305 244)"/>
    <ellipse cx="340" cy="239" rx="8" ry="5" fill="#3D5C3A" transform="rotate(30 340 239)"/>
    <ellipse cx="310" cy="254" rx="7" ry="4" fill="#4A7A47" transform="rotate(-20 310 254)"/>
    <ellipse cx="342" cy="251" rx="7" ry="4" fill="#4A7A47" transform="rotate(20 342 251)"/>

    {/* Shelf legs */}
    <rect x="75" y="310" width="8" height="30" fill="#5C3D2E"/>
    <rect x="317" y="310" width="8" height="30" fill="#5C3D2E"/>
  </svg>
);

export default BookshelfIllustration;
