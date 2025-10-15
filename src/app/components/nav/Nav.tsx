import Image from "next/image.js";
import Link from "next/link";
import styles from "./Nav.module.css";

export const Nav = () => {
  return (
    <nav className={styles.nav}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo} aria-label="Nuffield Health">
          <Image
            src="https://www.nuffieldhealth.com/assets/dist/images/logo_inverse.svg"
            className={styles.logoImage}
            alt="Nuffield Health Logo"
            width={180}
            height={40}
            priority
          />
        </Link>
      </div>
    </nav>
  );
};
