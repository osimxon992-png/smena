// Profil tanlovlari: server (lib/api.ts) faqat shulardan birini qabul qiladi, brauzer ro'yxat qilib ko'rsatadi

// Viloyat (Toshkent shahri, 12 viloyat va Qoraqalpog'iston) → uning tumanlari va shaharlari
export const REGIONS: Record<string, string[]> = {
  'Toshkent shahri': [
    'Bektemir', 'Chilonzor', 'Mirobod', 'Mirzo Ulug‘bek', 'Olmazor', 'Sergeli',
    'Shayxontohur', 'Uchtepa', 'Yakkasaroy', 'Yangihayot', 'Yashnobod', 'Yunusobod',
  ],
  'Toshkent viloyati': [
    'Angren shahri', 'Bekobod shahri', 'Chirchiq shahri', 'Nurafshon shahri', 'Olmaliq shahri', 'Ohangaron shahri', 'Yangiyo‘l shahri',
    'Bekobod tumani', 'Bo‘ka', 'Bo‘stonliq', 'Chinoz', 'Ohangaron tumani', 'Oqqo‘rg‘on', 'O‘rta Chirchiq', 'Parkent', 'Piskent',
    'Qibray', 'Quyi Chirchiq', 'Toshkent tumani', 'Yangiyo‘l tumani', 'Yuqori Chirchiq', 'Zangiota',
  ],
  'Andijon viloyati': [
    'Andijon shahri', 'Xonobod shahri',
    'Andijon tumani', 'Asaka', 'Baliqchi', 'Bo‘ston', 'Buloqboshi', 'Izboskan', 'Jalaquduq', 'Marhamat',
    'Oltinko‘l', 'Paxtaobod', 'Qo‘rg‘ontepa', 'Shahrixon', 'Ulug‘nor', 'Xo‘jaobod',
  ],
  'Buxoro viloyati': [
    'Buxoro shahri', 'Kogon shahri',
    'Buxoro tumani', 'G‘ijduvon', 'Jondor', 'Kogon tumani', 'Olot', 'Peshku', 'Qorako‘l', 'Qorovulbozor', 'Romitan', 'Shofirkon', 'Vobkent',
  ],
  'Farg‘ona viloyati': [
    'Farg‘ona shahri', 'Marg‘ilon shahri', 'Qo‘qon shahri', 'Quvasoy shahri',
    'Beshariq', 'Bog‘dod', 'Buvayda', 'Dang‘ara', 'Farg‘ona tumani', 'Furqat', 'Oltiariq', 'O‘zbekiston', 'Qo‘shtepa',
    'Quva', 'Rishton', 'So‘x', 'Toshloq', 'Uchko‘prik', 'Yozyovon',
  ],
  'Jizzax viloyati': [
    'Jizzax shahri',
    'Arnasoy', 'Baxmal', 'Do‘stlik', 'Forish', 'G‘allaorol', 'Mirzacho‘l', 'Paxtakor', 'Sharof Rashidov', 'Yangiobod', 'Zafarobod', 'Zarbdor', 'Zomin',
  ],
  'Xorazm viloyati': [
    'Urganch shahri', 'Xiva shahri',
    'Bog‘ot', 'Gurlan', 'Hazorasp', 'Qo‘shko‘pir', 'Shovot', 'Tuproqqal’a', 'Urganch tumani', 'Xiva tumani', 'Xonqa', 'Yangiariq', 'Yangibozor',
  ],
  'Namangan viloyati': [
    'Namangan shahri',
    'Chortoq', 'Chust', 'Kosonsoy', 'Mingbuloq', 'Namangan tumani', 'Norin', 'Pop', 'To‘raqo‘rg‘on', 'Uchqo‘rg‘on', 'Uychi', 'Yangiqo‘rg‘on',
  ],
  'Navoiy viloyati': [
    'Navoiy shahri', 'Zarafshon shahri',
    'Karmana', 'Konimex', 'Navbahor', 'Nurota', 'Qiziltepa', 'Tomdi', 'Uchquduq', 'Xatirchi',
  ],
  'Qashqadaryo viloyati': [
    'Qarshi shahri', 'Shahrisabz shahri',
    'Chiroqchi', 'Dehqonobod', 'G‘uzor', 'Kasbi', 'Kitob', 'Ko‘kdala', 'Koson', 'Mirishkor', 'Muborak', 'Nishon',
    'Qamashi', 'Qarshi tumani', 'Shahrisabz tumani', 'Yakkabog‘',
  ],
  'Samarqand viloyati': [
    'Samarqand shahri', 'Kattaqo‘rg‘on shahri',
    'Bulung‘ur', 'Ishtixon', 'Jomboy', 'Kattaqo‘rg‘on tumani', 'Narpay', 'Nurobod', 'Oqdaryo', 'Pastdarg‘om', 'Paxtachi',
    'Payariq', 'Qo‘shrabot', 'Samarqand tumani', 'Toyloq', 'Urgut',
  ],
  'Sirdaryo viloyati': [
    'Guliston shahri', 'Shirin shahri', 'Yangiyer shahri',
    'Boyovut', 'Guliston tumani', 'Mirzaobod', 'Oqoltin', 'Sardoba', 'Sayxunobod', 'Sirdaryo tumani', 'Xovos',
  ],
  'Surxondaryo viloyati': [
    'Termiz shahri',
    'Angor', 'Bandixon', 'Boysun', 'Denov', 'Jarqo‘rg‘on', 'Muzrabot', 'Oltinsoy', 'Qiziriq', 'Qumqo‘rg‘on',
    'Sariosiyo', 'Sherobod', 'Sho‘rchi', 'Termiz tumani', 'Uzun',
  ],
  'Qoraqalpog‘iston Respublikasi': [
    'Nukus shahri',
    'Amudaryo', 'Beruniy', 'Bo‘zatov', 'Chimboy', 'Ellikqal’a', 'Kegeyli', 'Mo‘ynoq', 'Nukus tumani', 'Qanliko‘l',
    'Qo‘ng‘irot', 'Qorao‘zak', 'Shumanay', 'Taxiatosh', 'Taxtako‘pir', 'To‘rtko‘l', 'Xo‘jayli',
  ],
};
export const SKILLS = [
  'Ofitsiant', 'Oshxona yordamchisi', 'Buyurtma teruvchi', 'Yuk tashuvchi', 'Promouter',
  'Kassir', 'Tozalovchi', 'Kuryer', 'Animator', 'Qorovul',
];
export const ORG_TYPES = ['To‘yxona', 'Restoran yoki kafe', 'Ombor', 'Do‘kon', 'Topshirish punkti', 'Tadbir tashkilotchisi', 'Boshqa'];
export const MIN_AGE = 16;
