import Image from "next/image.js";
import Link from "next/link";
import { ButtonLink } from "../buttonLink/ButtonLink";
import styles from "./Nav.module.css";

export const Nav = () => {
  return (
    <nav className={styles.nav}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <Image
            src="assets/nuffield-logo.svg"
            className={styles.logoImage}
            alt="Nuffield Health Logo"
            width="180"
            height="40"
          />
          <div className={styles.logoText}>Voice Agent Studio</div>
        </Link>

        <ButtonLink url="https://github.com/deepgram-starters" size="large">
          <span style={{ marginRight: "10px" }}>Get the code on Github</span>
        </ButtonLink>
      </div>
    </nav>
  );
};
