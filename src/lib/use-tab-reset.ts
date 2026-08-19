/**
 * Sekme ikonuna basınca sayfanın başına dön.
 *
 * Sorun: sihirbazın üçüncü adımındayken alttaki "Keşfet" ikonuna basmak
 * hiçbir şey yapmıyordu — kullanıcı adımların içinde kilitli kalıyordu ve
 * geri dönmenin tek yolu tek tek "Geri"ye basmaktı.
 *
 * React Navigation zaten sekmeye basıldığında `tabPress` olayı yayıyor;
 * ekranlar bunu dinleyip kendi yerel durumlarını sıfırlıyor. Yığın
 * ekranlarında bu iş kendiliğinden oluyor, ama sihirbazın adımı ve
 * kilerdeki seçim gibi **bileşen içi** durumlar için elle sıfırlamak gerek.
 */

import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';

export function useTabReset(reset: () => void) {
  const navigation = useNavigation();

  // Referansla tutuluyor: `reset` her render'da yeniden yaratılıyor ve
  // bağımlılığa konursa dinleyici her karede sökülüp takılıyor.
  const ref = useRef(reset);
  ref.current = reset;

  useEffect(() => {
    /**
     * `tabPress` ekranın **kendi** navigation nesnesinde yayılıyor — bu nesne
     * sekme gezgine ait. Üstteki yığına (getParent) bağlanmak sessizce
     * hiçbir şey dinlememek demek.
     */
    const unsubscribe = navigation.addListener('tabPress' as never, () => {
      ref.current();
    });
    return unsubscribe;
  }, [navigation]);
}
