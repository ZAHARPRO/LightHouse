<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251214203516 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE subscriptions DROP FOREIGN KEY FK_4778A01A76ED395');
        $this->addSql('DROP TABLE subscriptions');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE subscriptions (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, INDEX IDX_4778A01A76ED395 (user_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB COMMENT = \'\' ');
        $this->addSql('ALTER TABLE subscriptions ADD CONSTRAINT FK_4778A01A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
    }
}
